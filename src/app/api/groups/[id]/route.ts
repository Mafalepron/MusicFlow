import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const group = await db.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, projects: true },
        },
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      genre: group.genre,
      inviteCode: group.inviteCode,
      ownerId: group.ownerId,
      memberCount: group._count.members,
      projectCount: group._count.projects,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Get group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/groups/[id] — partial update of an existing group.
// Used by the sidebar's editable artist-profile description.
const patchGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  genre: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = patchGroupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Make sure the group exists
    const existing = await db.group.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const updated = await db.group.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: {
          select: { members: true, projects: true },
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      avatarUrl: updated.avatarUrl,
      genre: updated.genre,
      inviteCode: updated.inviteCode,
      ownerId: updated.ownerId,
      memberCount: updated._count.members,
      projectCount: updated._count.projects,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Update group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
