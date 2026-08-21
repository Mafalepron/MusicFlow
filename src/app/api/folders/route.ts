import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createFolderSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1).max(200),
})

// GET /api/folders?groupId=<groupId>
// Returns all folders for a group, each with its projects included.
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

    const folders = await db.folder.findMany({
      where: { groupId },
      include: {
        projects: {
          select: {
            id: true,
            groupId: true,
            folderId: true,
            title: true,
            type: true,
            coverUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            kanbanTask: { select: { id: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const result = folders.map((f: typeof folders[number]) => ({
      id: f.id,
      groupId: f.groupId,
      title: f.title,
      sortOrder: f.sortOrder,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      projects: f.projects.map((p) => ({
        id: p.id,
        groupId: p.groupId,
        folderId: p.folderId,
        title: p.title,
        type: p.type,
        coverUrl: p.coverUrl,
        status: p.status,
        kanbanTaskId: p.kanbanTask?.id ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('List folders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/folders
// Body: { groupId, title } — creates a new folder.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createFolderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { groupId, title } = parsed.data

    const group = await db.group.findUnique({ where: { id: groupId } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Place the new folder after the highest existing sortOrder for this group
    const maxSort = await db.folder.aggregate({
      where: { groupId },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

    const folder = await db.folder.create({
      data: { groupId, title, sortOrder },
    })

    return NextResponse.json(
      {
        id: folder.id,
        groupId: folder.groupId,
        title: folder.title,
        sortOrder: folder.sortOrder,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString(),
        projects: [],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
