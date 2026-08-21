import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const updateProjectSchema = z.object({
  status: z.enum(['in_progress', 'mixing', 'mastering', 'released']).optional(),
  folderId: z.string().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tracks: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: project.id,
      groupId: project.groupId,
      folderId: project.folderId,
      title: project.title,
      type: project.type,
      coverUrl: project.coverUrl,
      status: project.status,
      trackCount: project._count.tracks,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Get project detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build update data — only include the fields that were provided.
    // Both `status` and `folderId` are optional in the schema.
    const updateData: { status?: string; folderId?: string | null } = {}
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status
    }
    if (parsed.data.folderId !== undefined) {
      // Validate that the target folder exists (if not null) and belongs to
      // the same group as the project.
      if (parsed.data.folderId !== null) {
        const folder = await db.folder.findUnique({
          where: { id: parsed.data.folderId },
        })
        if (!folder) {
          return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
        }
        if (folder.groupId !== existing.groupId) {
          return NextResponse.json(
            { error: 'Folder does not belong to the same group' },
            { status: 400 }
          )
        }
      }
      updateData.folderId = parsed.data.folderId
    }

    const project = await db.project.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      id: project.id,
      groupId: project.groupId,
      folderId: project.folderId,
      title: project.title,
      type: project.type,
      coverUrl: project.coverUrl,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
