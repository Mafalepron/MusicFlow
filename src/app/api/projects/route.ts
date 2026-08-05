import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['album', 'ep', 'single']),
  groupId: z.string().min(1),
})

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

    const project = await db.project.create({
      data: {
        title,
        type,
        groupId,
      },
    })

    return NextResponse.json(
      {
        id: project.id,
        groupId: project.groupId,
        title: project.title,
        type: project.type,
        coverUrl: project.coverUrl,
        status: project.status,
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
