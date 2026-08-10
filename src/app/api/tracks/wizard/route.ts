import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_INSTRUMENTS = [
  'Вокал (основной)', 'Бэк-вокал', 'Гитара (акустическая)',
  'Гитара (электро)', 'Бас', 'Барабаны', 'Синтезатор',
  '808-й бас', 'Сэмплы', 'Струнные', 'Духовые',
];

const STAGE_TEMPLATES: Record<string, { emoji: string; label: string; defaultSubtasks: string[]; instrumentBased?: boolean }> = {
  'Сонграйтинг': {
    emoji: '📝',
    label: 'Сонграйтинг',
    defaultSubtasks: ['Написание текста', 'Демо'],
  },
  'Аранжировка': {
    emoji: '🎹',
    label: 'Аранжировка',
    defaultSubtasks: ['Гармоническая структура', 'Тембровая расстановка'],
  },
  'Запись': {
    emoji: '🎸',
    label: 'Запись',
    defaultSubtasks: [],
    instrumentBased: true,
  },
  'Редактура': {
    emoji: '✂️',
    label: 'Редактура',
    defaultSubtasks: ['Компинг', 'Тюнинг вокала', 'Тайминг'],
  },
  'Сведение': {
    emoji: '🎛',
    label: 'Сведение',
    defaultSubtasks: ['Баланс и эквализация', 'Пространственная обработка', 'Эффекты и автоматизация'],
  },
  'Мастеринг': {
    emoji: '🎚',
    label: 'Мастеринг',
    defaultSubtasks: ['Финальная громкость и лимитирование', 'Стерео-обработка'],
  },
};

export async function GET() {
  return NextResponse.json({
    instruments: DEFAULT_INSTRUMENTS,
    stages: Object.entries(STAGE_TEMPLATES).map(([key, v]) => ({
      key,
      label: v.label,
      emoji: v.emoji,
      hasInstrumentBased: !!v.instrumentBased,
      defaultSubtaskCount: v.defaultSubtasks.length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, deadline, instruments, stages, boardId, customStages, userId } = body;

  if (!title?.trim() || !boardId) {
    return NextResponse.json({ error: 'title and boardId required' }, { status: 400 });
  }

  const safeInstruments = (instruments || []).filter(Boolean);

  // Determine stage data source
  let stageData: { emoji: string; label: string; description: string; subtasks: { title: string; description: string }[] }[] = [];

  if (customStages?.length > 0) {
    // Use custom stages from step 4 editor
    stageData = customStages.map((cs: { emoji?: string; label: string; description?: string; subtasks?: { title: string; description?: string }[] }) => ({
      emoji: cs.emoji || '📁',
      label: cs.label,
      description: cs.description || null,
      subtasks: (cs.subtasks || []).map((st) => ({
        title: st.title,
        description: st.description || null,
      })),
    }));
  } else {
    // Legacy: build from stage keys
    const safeStages = (stages || []).filter((s: string) => STAGE_TEMPLATES[s]);
    if (!safeStages.length) {
      return NextResponse.json({ error: 'At least one stage required' }, { status: 400 });
    }
    stageData = safeStages.map((stageKey: string) => {
      const template = STAGE_TEMPLATES[stageKey];
      if (!template) return null;
      let subtasks: { title: string; description: string | null }[] = [];
      if (template.instrumentBased && safeInstruments.length > 0) {
        subtasks = safeInstruments.map((i: string) => ({ title: `Запись: ${i}`, description: null }));
      } else {
        subtasks = template.defaultSubtasks.map((s: string) => ({ title: s, description: null }));
      }
      return {
        emoji: template.emoji,
        label: template.label,
        description: null as string | null,
        subtasks,
      };
    }).filter(Boolean) as typeof stageData;
  }

  if (!stageData.length) {
    return NextResponse.json({ error: 'At least one stage required' }, { status: 400 });
  }

  // --- Bridge: find the linked SoundFlow Project via board → kanban project ---
  // boardId → Board.projectId (kanban Task with isProject=true) → soundflowProjectId (Project)
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { projectId: true },
  });
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const kanbanProject = await db.task.findUnique({
    where: { id: board.projectId },
    select: { soundflowProjectId: true },
  });

  // Create a SoundFlow Track if the kanban project is linked to a real Project
  let soundflowTrackId: string | null = null;
  if (kanbanProject?.soundflowProjectId && userId) {
    const sfProjectId = kanbanProject.soundflowProjectId;
    const existingTrackCount = await db.track.count({ where: { projectId: sfProjectId } });
    const sfTrack = await db.track.create({
      data: {
        title: title.trim(),
        projectId: sfProjectId,
        createdBy: userId,
        audioUrl: '',
        durationMs: null,
        trackNumber: existingTrackCount + 1,
      },
    });
    soundflowTrackId = sfTrack.id;
  }

  // Create track task (kanban), linked to the SoundFlow Track if it exists
  const track = await db.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || undefined,
      status: 'todo',
      priority: 'medium',
      category: 'recording',
      boardId,
      trackConfig: JSON.stringify({ instruments: safeInstruments, stages: stageData.map(s => s.label) }),
      hexQ: 0,
      hexR: 0,
      ...(deadline ? { deadline: new Date(deadline) } : {}),
      ...(soundflowTrackId ? { soundflowTrackId } : {}),
    },
  });

  // Create stage tasks and their children
  for (let i = 0; i < stageData.length; i++) {
    const stage = stageData[i];
    const stageTask = await db.task.create({
      data: {
        title: `${stage.emoji} ${stage.label}`,
        description: stage.description || undefined,
        status: i === 0 ? 'in-progress' : 'todo',
        priority: 'medium',
        category: 'recording',
        parentId: track.id,
        boardId,
        hexQ: 0,
        hexR: i,
      },
    });

    for (let j = 0; j < stage.subtasks.length; j++) {
      const subtask = stage.subtasks[j];
      await db.task.create({
        data: {
          title: subtask.title,
          description: subtask.description || undefined,
          status: 'todo',
          priority: 'medium',
          category: 'recording',
          parentId: stageTask.id,
          boardId,
          hexQ: j,
          hexR: 0,
        },
      });
    }
  }

  // --- Cross-board mirroring: create linked tasks on Mixing, Mastering, References boards ---
  // When a track is created, a matching task appears on each of these boards,
  // linked via soundflowTrackId so they stay connected to the same track.
  const MIRROR_BOARDS = [
    { title: 'Сведение', taskTitle: `${title.trim()} — Сведение` },
    { title: 'Мастеринг', taskTitle: `${title.trim()} — Мастеринг` },
    { title: 'Референсы', taskTitle: `${title.trim()} — Референсы` },
  ];

  // Find sibling boards in the same kanban project
  const siblingBoards = await db.board.findMany({
    where: {
      projectId: board.projectId,
      isGhost: false,
      title: { in: MIRROR_BOARDS.map((b) => b.title) },
    },
    select: { id: true, title: true },
  });

  for (const mirror of MIRROR_BOARDS) {
    const targetBoard = siblingBoards.find((b) => b.title === mirror.title);
    if (!targetBoard) continue;

    await db.task.create({
      data: {
        title: mirror.taskTitle,
        description: `Связанная задача для трека «${title.trim()}»`,
        status: 'todo',
        priority: 'medium',
        category: 'recording',
        boardId: targetBoard.id,
        hexQ: 0,
        hexR: 0,
        ...(deadline ? { deadline: new Date(deadline) } : {}),
        ...(soundflowTrackId ? { soundflowTrackId } : {}),
      },
    });
  }

  return NextResponse.json({ trackId: track.id, soundflowTrackId }, { status: 201 });
}
