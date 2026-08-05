import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const tracks = await db.track.findMany({
      where: { projectId: id },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { trackNumber: 'asc' },
    })

    const result = tracks.map((t: typeof tracks[number]) => ({
      id: t.id,
      projectId: t.projectId,
      sourceIdeaId: t.sourceIdeaId,
      title: t.title,
      trackNumber: t.trackNumber,
      audioUrl: t.audioUrl,
      waveformUrl: t.waveformUrl,
      durationMs: t.durationMs,
      status: t.status,
      version: t.version,
      createdBy: t.createdBy,
      creator: t.creator,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('List tracks error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
