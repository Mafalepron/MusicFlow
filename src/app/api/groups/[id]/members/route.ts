import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const members = await db.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    const result = members.map((m: {
      userId: string
      role: string
      instrument: string | null
      joinedAt: Date
      user: {
        displayName: string | null
        email: string | null
        avatarUrl: string | null
      }
    }) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      instrument: m.instrument,
      joinedAt: m.joinedAt.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get group members error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
