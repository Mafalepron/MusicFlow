import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const updateCommentSchema = z.object({
  text: z.string().min(1, 'Comment text is required').max(2000).optional(),
  isResolved: z.boolean().optional(),
  timestampMs: z.number().int().min(0).optional(),
  rangeEndMs: z.number().int().min(0).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: trackId, commentId } = await params

    const track = await db.track.findUnique({ where: { id: trackId } })
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }

    const existing = await db.comment.findUnique({ where: { id: commentId } })
    if (!existing || existing.trackId !== trackId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const comment = await db.comment.update({
      where: { id: commentId },
      data: parsed.data,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        version: { select: { id: true, version: true, label: true } },
      },
    })

    return NextResponse.json({
      ...comment,
      versionId: comment.versionId,
      version: comment.version,
      createdAt: comment.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Update comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: trackId, commentId } = await params

    const track = await db.track.findUnique({ where: { id: trackId } })
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }

    const existing = await db.comment.findUnique({ where: { id: commentId } })
    if (!existing || existing.trackId !== trackId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    await db.comment.delete({ where: { id: commentId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
