import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['album', 'ep', 'single']),
  groupId: z.string().min(1),
})

// Autoboard definitions (shared with /api/boards route)
const ALBUM_DEFAULT_BOARDS = [
  { title: 'Треки', boardType: 'tracks', color: '#00d9ff', sortOrder: 0 },
  { title: 'Дизайн', boardType: 'general', color: '#a855f7', sortOrder: 1 },
  { title: 'Дистрибуция', boardType: 'general', color: '#eab308', sortOrder: 2 },
  { title: 'Маркетинг', boardType: 'general', color: '#f43f5e', sortOrder: 3 },
  { title: 'Сведение', boardType: 'general', color: '#ff8c00', sortOrder: 4 },
  { title: 'Мастеринг', boardType: 'general', color: '#06b6d4', sortOrder: 5 },
  { title: 'Референсы', boardType: 'general', color: '#00ff88', sortOrder: 6 },
]

const SINGLE_DEFAULT_BOARDS = [
  { title: 'Трек', boardType: 'tracks', color: '#00d9ff', sortOrder: 0 },
  { title: 'Обложка', boardType: 'general', color: '#a855f7', sortOrder: 1 },
  { title: 'Публикация', boardType: 'general', color: '#eab308', sortOrder: 2 },
  { title: 'Продвижение', boardType: 'general', color: '#f43f5e', sortOrder: 3 },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId query parameter is required' },
        { status: 400 }
      )
    }

    const projects = await db.project.findMany({
      where: { groupId },
      include: {
        _count: {
          select: { tracks: true },
        },
        kanbanTask: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = projects.map((p: typeof projects[number]) => ({
      id: p.id,
      groupId: p.groupId,
      title: p.title,
      type: p.type,
      coverUrl: p.coverUrl,
      status: p.status,
      trackCount: p._count.tracks,
      kanbanTaskId: p.kanbanTask?.id || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('List projects error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { title, type, groupId } = parsed.data

    const group = await db.group.findUnique({ where: { id: groupId } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // 1. Create the SoundFlow Project
    const project = await db.project.create({
      data: { title, type, groupId },
    })

    // 2. For album/ep/single: create a linked Kanban Task + autoboards
    let kanbanTaskId: string | null = null
    if (type === 'album' || type === 'ep' || type === 'single') {
      const kanbanTask = await db.task.create({
        data: {
          title,
          isProject: true,
          projectType: type,
          soundflowProjectId: project.id,
          status: 'todo',
          category: 'general',
        },
      })
      kanbanTaskId = kanbanTask.id

      // 3. Create autoboards (ghost boards) for the kanban project
      const boards = type === 'single' ? SINGLE_DEFAULT_BOARDS : ALBUM_DEFAULT_BOARDS
      for (const def of boards) {
        await db.board.create({
          data: {
            title: def.title,
            color: def.color,
            boardType: def.boardType,
            sortOrder: def.sortOrder,
            projectId: kanbanTask.id,
            isGhost: true,
          },
        })
      }
    }

    return NextResponse.json(
      {
        id: project.id,
        groupId: project.groupId,
        title: project.title,
        type: project.type,
        coverUrl: project.coverUrl,
        status: project.status,
        kanbanTaskId,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
