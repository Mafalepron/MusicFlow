import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  groupId: z.string().min(1),
  userId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const projectId = searchParams.get('projectId')

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId query parameter is required' },
        { status: 400 }
      )
    }

    // Build where clause:
    // - If projectId is given, return ideas belonging to that project
    // - Otherwise return unassigned ideas (projectId: null), the default behaviour
    const where: { groupId: string; projectId: string | null } = {
      groupId,
      projectId: projectId || null,
    }

    const ideas = await db.idea.findMany({
      where,
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = ideas.map((idea: typeof ideas[number]) => ({
      id: idea.id,
      groupId: idea.groupId,
      createdBy: idea.createdBy,
      title: idea.title,
      description: idea.description,
      audioUrl: idea.audioUrl,
      waveformUrl: idea.waveformUrl,
      durationMs: idea.durationMs,
      tags: idea.tags,
      projectId: idea.projectId,
      creator: idea.creator,
      createdAt: idea.createdAt.toISOString(),
      updatedAt: idea.updatedAt.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('List ideas error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createIdeaSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { title, description, tags, groupId, userId } = parsed.data

    const group = await db.group.findUnique({ where: { id: groupId } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const idea = await db.idea.create({
      data: {
        title,
        description,
        tags: tags ? JSON.stringify(tags) : null,
        groupId,
        createdBy: userId,
      },
    })

    return NextResponse.json(
      {
        id: idea.id,
        groupId: idea.groupId,
        createdBy: idea.createdBy,
        title: idea.title,
        description: idea.description,
        audioUrl: idea.audioUrl,
        waveformUrl: idea.waveformUrl,
        durationMs: idea.durationMs,
        tags: idea.tags,
        projectId: idea.projectId,
        createdAt: idea.createdAt.toISOString(),
        updatedAt: idea.updatedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create idea error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
