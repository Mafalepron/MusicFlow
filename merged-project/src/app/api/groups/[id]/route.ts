import { NextRequest, NextResponse } from 'next/server'
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
