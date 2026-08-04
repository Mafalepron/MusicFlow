import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'

const createTrackSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  projectId: z.string().min(1, 'Project ID is required'),
  createdBy: z.string().min(1, 'Creator user ID is required'),
  sourceIdeaId: z.string().optional(),
})

const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio')

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let title: string
    let projectId: string
    let createdBy: string
    let sourceIdeaId: string | undefined
    let audioUrl = ''
    let durationMs: number | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const titleField = formData.get('title')
      const projectIdField = formData.get('projectId')
      const createdByField = formData.get('createdBy')
      const sourceIdeaIdField = formData.get('sourceIdeaId')
      const audioFile = formData.get('audio') as File | null

      const parsed = createTrackSchema.safeParse({
        title: titleField,
        projectId: projectIdField,
        createdBy: createdByField,
        sourceIdeaId: sourceIdeaIdField ?? undefined,
      })

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      title = parsed.data.title
      projectId = parsed.data.projectId
      createdBy = parsed.data.createdBy
      sourceIdeaId = parsed.data.sourceIdeaId

      if (audioFile && audioFile.size > 0) {
        const ext = path.extname(audioFile.name) || '.mp3'
        const filename = `${crypto.randomUUID()}${ext}`
        const filepath = path.join(AUDIO_DIR, filename)

        // Ensure the uploads/audio directory exists before writing.
        // mkdir with recursive:true is a no-op if it already exists.
        await mkdir(AUDIO_DIR, { recursive: true })

        const bytes = await audioFile.arrayBuffer()
        await writeFile(filepath, Buffer.from(bytes))

        audioUrl = `/api/uploads/audio/${filename}`
        durationMs = 0
      }
    } else {
      const body = await request.json()
      const parsed = createTrackSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      title = parsed.data.title
      projectId = parsed.data.projectId
      createdBy = parsed.data.createdBy
      sourceIdeaId = parsed.data.sourceIdeaId
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const existingTrackCount = await db.track.count({ where: { projectId } })

    const track = await db.track.create({
      data: {
        title,
        projectId,
        createdBy,
        sourceIdeaId: sourceIdeaId ?? null,
        audioUrl,
        durationMs: durationMs ?? null,
        trackNumber: existingTrackCount + 1,
      },
      include: {
        creator: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    })

    return NextResponse.json(
      {
        ...track,
        createdAt: track.createdAt.toISOString(),
        updatedAt: track.updatedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create track error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
