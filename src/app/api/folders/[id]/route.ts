import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const updateFolderSchema = z.object({
  title: z.string().min(1).max(200),
})

// PATCH /api/folders/[id] — updates the folder title.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateFolderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.folder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const folder = await db.folder.update({
      where: { id },
      data: { title: parsed.data.title },
    })

    return NextResponse.json({
      id: folder.id,
      groupId: folder.groupId,
      title: folder.title,
      sortOrder: folder.sortOrder,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Update folder error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/folders/[id] — deletes the folder. Projects' folderId gets set
// to null automatically via the onDelete: SetNull relation in the schema.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.folder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    await db.folder.delete({ where: { id } })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Delete folder error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
