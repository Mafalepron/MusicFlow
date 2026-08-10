import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Large color palette for board creation — 20 visually distinct colors
const BOARD_COLORS = [
  '#00d9ff', // cyan
  '#ff6b35', // orange-red
  '#ec4899', // pink
  '#10b981', // emerald
  '#a855f7', // purple
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // teal
  '#84cc16', // lime
  '#f97316', // orange
  '#3b82f6', // blue
  '#d946ef', // fuchsia
  '#14b8a6', // teal-green
  '#eab308', // yellow
  '#f43f5e', // rose
  '#22c55e', // green
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#fb7185', // light rose
];

// Autoboard definitions — each board gets a unique, visually distinct color
const ALBUM_DEFAULT_BOARDS = [
  { title: 'Треки',       boardType: 'tracks',     color: '#00d9ff', sortOrder: 0 },
  { title: 'Дизайн',      boardType: 'general',   color: '#a855f7', sortOrder: 1 },
  { title: 'Дистрибуция', boardType: 'general',   color: '#f59e0b', sortOrder: 2 },
  { title: 'Маркетинг',   boardType: 'general',   color: '#ec4899', sortOrder: 3 },
  { title: 'Сведение',    boardType: 'general',   color: '#ff6b35', sortOrder: 4 },
  { title: 'Мастеринг',   boardType: 'general',   color: '#10b981', sortOrder: 5 },
  { title: 'Референсы',   boardType: 'general',   color: '#8b5cf6', sortOrder: 6 },
];

const SINGLE_DEFAULT_BOARDS = [
  { title: 'Трек',         boardType: 'tracks',     color: '#00d9ff', sortOrder: 0 },
  { title: 'Обложка',      boardType: 'general',   color: '#a855f7', sortOrder: 1 },
  { title: 'Публикация',   boardType: 'general',   color: '#f59e0b', sortOrder: 2 },
  { title: 'Продвижение',  boardType: 'general',   color: '#ec4899', sortOrder: 3 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const boards = await db.board.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    include: {
      tasks: {
        where: { parentId: null },
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return NextResponse.json({ boards });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, color, projectId, boardType, createAlbumDefaults, createSingleDefaults } = body;

  if (!title?.trim() || !projectId) {
    return NextResponse.json({ error: 'title and projectId required' }, { status: 400 });
  }

  const existingCount = await db.board.count({ where: { projectId } });

  // If creating single defaults, create all default boards as ghost
  if (createSingleDefaults) {
    const created = [];
    for (const def of SINGLE_DEFAULT_BOARDS) {
      const board = await db.board.create({
        data: {
          title: def.title,
          color: def.color,
          boardType: def.boardType,
          sortOrder: def.sortOrder + existingCount,
          projectId,
          isGhost: true,
        },
      });
      created.push(board);
    }
    return NextResponse.json({ boards: created }, { status: 201 });
  }

  // If creating album defaults, create all default boards as ghost
  if (createAlbumDefaults) {
    const created = [];
    for (const def of ALBUM_DEFAULT_BOARDS) {
      const board = await db.board.create({
        data: {
          title: def.title,
          color: def.color,
          boardType: def.boardType,
          sortOrder: def.sortOrder + existingCount,
          projectId,
          isGhost: true,
        },
      });
      created.push(board);
    }
    return NextResponse.json({ boards: created }, { status: 201 });
  }

  const board = await db.board.create({
    data: {
      title: title.trim(),
      color: color || BOARD_COLORS[existingCount % BOARD_COLORS.length],
      boardType: boardType || 'general',
      sortOrder: existingCount,
      projectId,
    },
  });

  return NextResponse.json(board, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, title, color, activateGhost } = body;

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // Activate a ghost board (set isGhost = false)
  if (activateGhost) {
    const board = await db.board.update({
      where: { id },
      data: { isGhost: false },
    });
    return NextResponse.json(board);
  }

  const board = await db.board.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(color !== undefined && { color }),
    },
  });

  return NextResponse.json(board);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await db.board.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
