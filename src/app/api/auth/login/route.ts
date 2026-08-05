import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { db } from '@/lib/db'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (user.password !== hashPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const { password: _, ...userWithoutPassword } = user

    // Find user's first group membership
    const membership = await db.groupMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'desc' },
    })

    if (membership) {
      const group = await db.group.findUnique({ where: { id: membership.groupId } })
      const memberInfo = { role: membership.role, instrument: membership.instrument, joinedAt: membership.joinedAt.toISOString() }
      return NextResponse.json({
        user: userWithoutPassword,
        groupId: membership.groupId,
        memberInfo,
        group: group ? {
          id: group.id,
          name: group.name,
          description: group.description,
          avatarUrl: group.avatarUrl,
          genre: group.genre,
          inviteCode: group.inviteCode,
          ownerId: group.ownerId,
        } : null,
      })
    }

    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
