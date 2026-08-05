import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const search = searchParams.get('search');

  // Search tasks/subtasks for @ mention autocomplete
  if (search && projectId) {
    // SQLite doesn't support mode: 'insensitive', use lowercase comparison
    const searchLower = search.toLowerCase();

    // Search board tasks (level 1 - tracks/items)
    const allBoardTasks = await db.task.findMany({
      where: {
        boardId: { not: null },
        parentId: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        parentId: true,
        boardId: true,
        children: {
          select: { id: true, title: true, status: true, parentId: true },
          take: 5,
        },
      },
      take: 50,
    });

    // Filter in JS for case-insensitive matching
    const boardTasks = allBoardTasks.filter((t: { title: string }) => t.title.toLowerCase().includes(searchLower));

    // Search children (subtasks) directly
    const allChildTasks = await db.task.findMany({
      where: { parentId: { not: null } },
      select: { id: true, title: true, status: true, parentId: true },
      take: 50,
    });

    const matchedChildren = allChildTasks.filter((c: { title: string }) => c.title.toLowerCase().includes(searchLower));

    // Enrich children with parent title
    let childTasks: { id: string; title: string; status: string; parentId: string | null }[] = [];
    if (matchedChildren.length > 0) {
      const parentIds = Array.from(new Set(matchedChildren.map((c: { parentId: string | null }) => c.parentId).filter((id: string | null): id is string => Boolean(id))));
      const parents = await db.task.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, title: true },
      });
      const parentMap = Object.fromEntries(parents.map((p: { id: string; title: string }) => [p.id, p.title]));
      childTasks = matchedChildren.map((c: { id: string; title: string; status: string; parentId: string | null }) => ({
        ...c,
        title: `${c.title} (${parentMap[c.parentId!] || '—'})`,
      }));
    }

    const results = [
      ...boardTasks.slice(0, 10).map((t: { id: string; title: string }) => ({ id: t.id, title: t.title, type: 'task' as const })),
      ...childTasks.slice(0, 8).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title, type: 'subtask' as const })),
    ];

    return NextResponse.json({ results });
  }

  // Get chat messages
  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;

  const messages = await db.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      referencedTask: {
        select: { id: true, title: true, status: true },
      },
    },
    take: 100,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { content, projectId, author, referencedTaskId } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  // Parse @mentions from content to find referenced task IDs
  let refTaskId = referencedTaskId || null;
  if (!refTaskId) {
    const mentionMatch = content.match(/@task:([a-zA-Z0-9]+)/);
    if (mentionMatch) {
      refTaskId = mentionMatch[1];
    }
  }

  const message = await db.chatMessage.create({
    data: {
      content: content.trim(),
      projectId: projectId || null,
      author: author?.trim() || 'Пользователь',
      referencedTaskId: refTaskId,
    },
    include: {
      referencedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return NextResponse.json(message, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await db.chatMessage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
