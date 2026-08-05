import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const updateVersionSchema = z.object({
  label: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: trackId, versionId } = await params

    const track = await db.track.findUnique({ where: { id: trackId } })
    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateVersionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const version = await db.trackVersion.findUnique({
      where: { id: versionId },
    })

    if (!version || version.trackId !== trackId) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    const updated = await db.trackVersion.update({
      where: { id: versionId },
      data: parsed.data,
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      trackId: updated.trackId,
      version: updated.version,
      label: updated.label,
      audioUrl: updated.audioUrl,
      durationMs: updated.durationMs,
      createdBy: updated.createdBy,
      creator: updated.creator,
      createdAt: updated.createdAt.toISOString(),
      commentCount: updated._count.comments,
    })
  } catch (error) {
    console.error('Update version error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
