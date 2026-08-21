import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const track = await db.track.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, type: true, status: true },
        },
        sourceIdea: {
          select: { id: true, title: true },
        },
        kanbanTasks: {
          select: { id: true },
          take: 1,
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...track,
      commentsCount: track._count.comments,
      kanbanTaskId: track.kanbanTasks?.[0]?.id || null,
      kanbanTasks: undefined,
      _count: undefined,
      createdAt: track.createdAt.toISOString(),
      updatedAt: track.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Get track error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH — partial update of an existing track.
// Accepts an optional subset of { title, status, audioUrl, coverUrl, description, genre }
// and updates only the supplied fields. Used by the Track Profile panel for inline
// editing of the track title, persistent status changes, and inline editing of the
// cover image / description / genre fields shown in the audio-form progress panel.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      title,
      status,
      audioUrl,
      coverUrl,
      description,
      genre,
    } = body as {
      title?: string
      status?: string
      audioUrl?: string
      coverUrl?: string | null
      description?: string | null
      genre?: string | null
    }

    const existing = await db.track.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = String(title).trim()
    if (status !== undefined) data.status = String(status)
    if (audioUrl !== undefined) data.audioUrl = String(audioUrl)
    if (coverUrl !== undefined) {
      data.coverUrl = coverUrl === null || coverUrl === '' ? null : String(coverUrl)
    }
    if (description !== undefined) {
      data.description = description === null ? null : String(description)
    }
    if (genre !== undefined) {
      data.genre = genre === null || genre === '' ? null : String(genre).trim()
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const updated = await db.track.update({
      where: { id },
      data,
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, type: true, status: true },
        },
        sourceIdea: {
          select: { id: true, title: true },
        },
        kanbanTasks: {
          select: { id: true },
          take: 1,
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    return NextResponse.json({
      ...updated,
      commentsCount: updated._count.comments,
      kanbanTaskId: updated.kanbanTasks?.[0]?.id || null,
      kanbanTasks: undefined,
      _count: undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Patch track error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
