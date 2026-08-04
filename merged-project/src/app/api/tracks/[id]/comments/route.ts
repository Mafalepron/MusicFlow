import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createCommentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  timestampMs: z.number().int().min(0, 'Timestamp must be non-negative'),
  rangeEndMs: z.number().int().min(0).optional(),
  text: z.string().min(1, 'Comment text is required').max(2000),
  trackId: z.string().min(1, 'Track ID is required'),
  versionId: z.string().optional(),
  parentId: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackId } = await params

    const track = await db.track.findUnique({ where: { id: trackId } })
    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }

    const comments = await db.comment.findMany({
      where: { trackId },
      orderBy: [{ timestampMs: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        version: {
          select: { id: true, version: true, label: true },
        },
      },
    })

    return NextResponse.json(
      comments.map((c: typeof comments[number]) => ({
        ...c,
        versionId: c.versionId,
        version: c.version,
        createdAt: c.createdAt.toISOString(),
        user: c.user,
      }))
    )
  } catch (error) {
    console.error('List comments error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackId } = await params

    const track = await db.track.findUnique({ where: { id: trackId } })
    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = createCommentSchema.safeParse({ ...body, trackId })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { userId, timestampMs, rangeEndMs, text, versionId, parentId } = parsed.data

    const comment = await db.comment.create({
      data: {
        trackId,
        userId,
        timestampMs,
        rangeEndMs,
        text,
        ...(versionId ? { versionId } : {}),
        ...(parentId ? { parentId } : {}),
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        version: {
          select: { id: true, version: true, label: true },
        },
      },
    })

    return NextResponse.json(
      {
        ...comment,
        versionId: comment.versionId,
        version: comment.version,
        createdAt: comment.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
