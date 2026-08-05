import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

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

    // If no versions exist yet, auto-create one from the track's current audio
    const existingVersions = await db.trackVersion.findMany({
      where: { trackId },
      orderBy: { version: 'asc' },
    })

    if (existingVersions.length === 0 && track.audioUrl) {
      await db.trackVersion.create({
        data: {
          trackId,
          version: 1,
          label: 'Original',
          audioUrl: track.audioUrl,
          durationMs: track.durationMs,
          createdBy: track.createdBy,
        },
      })
    }

    // Re-fetch after potential creation
    const versions = await db.trackVersion.findMany({
      where: { trackId },
      orderBy: { version: 'asc' },
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    return NextResponse.json(
      versions.map((v: typeof versions[number]) => ({
        id: v.id,
        trackId: v.trackId,
        version: v.version,
        label: v.label,
        audioUrl: v.audioUrl,
        durationMs: v.durationMs,
        createdBy: v.createdBy,
        creator: v.creator,
        createdAt: v.createdAt.toISOString(),
        commentCount: v._count.comments,
      }))
    )
  } catch (error) {
    console.error('List versions error:', error)
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

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const label = (formData.get('label') as string) || ''

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Save the audio file
    const bytes = await audioFile.arrayBuffer()
    const fileExtension = audioFile.name.split('.').pop() || 'mp3'
    const fileName = `${randomUUID()}.${fileExtension}`
    const filePath = join(process.cwd(), 'uploads', 'audio', fileName)

    await writeFile(filePath, Buffer.from(bytes))

    const audioUrl = `/api/uploads/audio/${fileName}`

    // Find current max version for this track
    const maxVersion = await db.trackVersion.aggregate({
      where: { trackId },
      _max: { version: true },
    })
    const nextVersion = (maxVersion._max.version || 0) + 1

    // Get createdBy from the form data or fall back to the track creator
    const createdBy = (formData.get('createdBy') as string) || track.createdBy

    // Create TrackVersion record
    const version = await db.trackVersion.create({
      data: {
        trackId,
        version: nextVersion,
        label: label || `v${nextVersion}`,
        audioUrl,
        durationMs: null, // will be updated if needed
        createdBy,
      },
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    // Increment track version to match
    await db.track.update({
      where: { id: trackId },
      data: { version: nextVersion },
    })

    return NextResponse.json(
      {
        id: version.id,
        trackId: version.trackId,
        version: version.version,
        label: version.label,
        audioUrl: version.audioUrl,
        durationMs: version.durationMs,
        createdBy: version.createdBy,
        creator: version.creator,
        createdAt: version.createdAt.toISOString(),
        commentCount: version._count.comments,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create version error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
