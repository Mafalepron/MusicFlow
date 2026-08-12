import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');
  const boardId = searchParams.get('boardId');
  const deep = searchParams.get('deep'); // 'true' for 2-level children
  const soundflowTrackId = searchParams.get('soundflowTrackId');

  let where: Record<string, unknown> = {};

  if (soundflowTrackId) {
    // Return all kanban tasks linked to a specific SoundFlow track.
    // Includes children 2 levels deep (forces deep=true behaviour) so the
    // caller gets the full task subtree for the track.
    where = { soundflowTrackId };
  } else if (boardId) {
    where = { boardId, parentId: null };
  } else if (parentId === null || parentId === 'null') {
    where = { parentId: null, isProject: true };
  } else {
    where = { parentId };
  }

  const childSelect = {
    id: true,
    title: true,
    description: true,
    status: true,
    isProject: true,
    deadline: true,
    category: true,
    priority: true,
    assignee: true,
    hexQ: true,
    hexR: true,
    soundflowTrackId: true,
  };

  const childrenArgs = (deep === 'true' || !!soundflowTrackId)
    ? {
        include: {
          children: {
            select: childSelect,
            orderBy: [
              { hexR: 'asc' as const },
              { hexQ: 'asc' as const },
              { createdAt: 'asc' as const },
            ],
          },
        },
        orderBy: [
          { hexR: 'asc' as const },
          { createdAt: 'asc' as const },
        ],
      }
    : {
        select: childSelect,
        orderBy: [
          { hexR: 'asc' as const },
          { hexQ: 'asc' as const },
          { createdAt: 'asc' as const },
        ],
      };

  const tasks = await db.task.findMany({
    where,
    orderBy: { createdAt: 'asc' as const },
    include: { children: childrenArgs, soundflowProject: { select: { id: true } } },
  });

  // Serialize: include soundflowProjectId and soundflowTrackId at top level
  const serialized = tasks.map((t: typeof tasks[number]) => ({
    ...t,
    soundflowProjectId: t.soundflowProject?.id || null,
    soundflowTrackId: t.soundflowTrackId || null,
  }));

  return NextResponse.json({ tasks: serialized });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, status, priority, assignee, category, isProject, parentId, boardId, deadline, projectType } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const siblingCount = await db.task.count({
    where: { parentId: parentId || null },
  });

  // For child tasks (stages/subtasks), allocate hexR linearly so they appear in
  // creation order when the GET endpoint sorts by hexR asc. For top-level tasks
  // (parentId is null) keep the spiral allocation used by the radial board.
  let q: number;
  let r: number;
  if (parentId) {
    q = 0;
    r = siblingCount;
  } else {
    const spiral = spiralToAxial(siblingCount);
    q = spiral.q;
    r = spiral.r;
  }

  const task = await db.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      status: status || 'todo',
      priority: priority || 'medium',
      assignee: assignee?.trim() || null,
      category: category || 'general',
      isProject: isProject || false,
      projectType: projectType || 'general',
      parentId: parentId || null,
      ...(boardId ? { boardId } : {}),
      ...(deadline ? { deadline: new Date(deadline) } : {}),
      hexQ: q,
      hexR: r,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, title, description, status, priority, assignee, category, isProject, boardId, deadline, hexQ, hexR, trackConfig } = body;

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const task = await db.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assignee !== undefined && { assignee: assignee?.trim() || null }),
      ...(category !== undefined && { category }),
      ...(isProject !== undefined && { isProject }),
      ...(boardId !== undefined && { boardId: boardId || null }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(hexQ !== undefined && { hexQ }),
      ...(hexR !== undefined && { hexR }),
      ...(trackConfig !== undefined && { trackConfig }),
    },
    include: {
      children: {
        select: { id: true, title: true, description: true, status: true, isProject: true, deadline: true, category: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await db.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

function spiralToAxial(index: number): { q: number; r: number } {
  if (index === 0) return { q: 0, r: 0 };

  let q = 0, r = 0;
  let direction = 0;
  let stepsInDir = 1;
  let stepCount = 0;
  let dirChangeCount = 0;

  const dirs = [
    { dq: 1, dr: 0 },
    { dq: 0, dr: 1 },
    { dq: -1, dr: 1 },
    { dq: -1, dr: 0 },
    { dq: 0, dr: -1 },
    { dq: 1, dr: -1 },
  ];

  for (let i = 0; i < index; i++) {
    q += dirs[direction].dq;
    r += dirs[direction].dr;
    stepCount++;
    if (stepCount === stepsInDir) {
      stepCount = 0;
      direction = (direction + 1) % 6;
      dirChangeCount++;
      if (dirChangeCount % 2 === 0) stepsInDir++;
    }
  }

  return { q, r };
}
