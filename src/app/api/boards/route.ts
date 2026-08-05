import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const BOARD_COLORS = ['#00d9ff', '#ff8c00', '#ff3366', '#00ff88', '#a855f7', '#eab308', '#06b6d4', '#f43f5e'];

const ALBUM_DEFAULT_BOARDS = [
  { title: 'Треки',       boardType: 'tracks',     color: '#00d9ff', sortOrder: 0 },
  { title: 'Дизайн',      boardType: 'general',   color: '#a855f7', sortOrder: 1 },
  { title: 'Дистрибуция', boardType: 'general',   color: '#eab308', sortOrder: 2 },
  { title: 'Маркетинг',   boardType: 'general',   color: '#f43f5e', sortOrder: 3 },
  { title: 'Сведение',    boardType: 'general',   color: '#ff8c00', sortOrder: 4 },
  { title: 'Мастеринг',   boardType: 'general',   color: '#06b6d4', sortOrder: 5 },
  { title: 'Референсы',   boardType: 'general',   color: '#00ff88', sortOrder: 6 },
];

const SINGLE_DEFAULT_BOARDS = [
  { title: 'Трек',         boardType: 'tracks',     color: '#00d9ff', sortOrder: 0 },
  { title: 'Обложка',      boardType: 'general',   color: '#a855f7', sortOrder: 1 },
  { title: 'Публикация',   boardType: 'general',   color: '#eab308', sortOrder: 2 },
  { title: 'Продвижение',  boardType: 'general',   color: '#f43f5e', sortOrder: 3 },
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
