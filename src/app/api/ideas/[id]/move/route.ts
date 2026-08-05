import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const moveIdeaSchema = z.object({
  projectId: z.string().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = moveIdeaSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { projectId } = parsed.data

    const idea = await db.idea.findUnique({ where: { id } })
    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (idea.projectId) {
      return NextResponse.json(
        { error: 'Idea has already been moved to a project' },
        { status: 400 }
      )
    }

    const trackCount = await db.track.count({ where: { projectId } })

    const track = await db.track.create({
      data: {
        projectId,
        sourceIdeaId: id,
        title: idea.title,
        trackNumber: trackCount + 1,
        audioUrl: idea.audioUrl || '',
        waveformUrl: idea.waveformUrl,
        durationMs: idea.durationMs,
        status: 'recording',
        version: 1,
        createdBy: idea.createdBy,
      },
    })

    await db.idea.update({
      where: { id },
      data: { projectId },
    })

    return NextResponse.json(
      {
        id: track.id,
        projectId: track.projectId,
        sourceIdeaId: track.sourceIdeaId,
        title: track.title,
        trackNumber: track.trackNumber,
        audioUrl: track.audioUrl,
        waveformUrl: track.waveformUrl,
        durationMs: track.durationMs,
        status: track.status,
        version: track.version,
        createdBy: track.createdBy,
        createdAt: track.createdAt.toISOString(),
        updatedAt: track.updatedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Move idea error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
