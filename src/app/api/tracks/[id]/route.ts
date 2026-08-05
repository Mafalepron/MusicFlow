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
        kanbanTask: {
          select: { id: true },
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
      kanbanTaskId: track.kanbanTask?.id || null,
      kanbanTask: undefined,
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
