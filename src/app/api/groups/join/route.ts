import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const joinSchema = z.object({
  code: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().optional(),
  instrument: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = joinSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { code, userId, role, instrument } = parsed.data

    const group = await db.group.findUnique({ where: { inviteCode: code.toUpperCase() } })
    if (!group) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } }
    })
    if (existing) {
      return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 })
    }

    const member = await db.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: role || 'member',
        instrument,
      },
    })

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        avatarUrl: group.avatarUrl,
        genre: group.genre,
        inviteCode: group.inviteCode,
        ownerId: group.ownerId,
        createdAt: group.createdAt.toISOString(),
      },
      memberInfo: {
        role: member.role,
        instrument: member.instrument || undefined,
        joinedAt: member.joinedAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Join group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
