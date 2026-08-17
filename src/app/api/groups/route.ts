import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// GET /api/groups?userId=<userId>
// Returns all groups the given user is a member of (including owned groups).
// Used by the sidebar's artist-profile group switcher.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    // Fetch all GroupMember rows for this user, then join the Group records.
    const memberships = await db.groupMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true, projects: true },
            },
          },
        },
      },
    })

    const groups = memberships
      .filter((m) => m.group !== null)
      .map((m) => ({
        id: m.group.id,
        name: m.group.name,
        description: m.group.description,
        avatarUrl: m.group.avatarUrl,
        genre: m.group.genre,
        inviteCode: m.group.inviteCode,
        ownerId: m.group.ownerId,
        memberCount: m.group._count.members,
        projectCount: m.group._count.projects,
        createdAt: m.group.createdAt.toISOString(),
        // membership info for this user
        role: m.role,
        instrument: m.instrument,
        joinedAt: m.joinedAt.toISOString(),
      }))

    return NextResponse.json(groups)
  } catch (error) {
    console.error('List groups error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  genre: z.string().max(50).optional(),
  userId: z.string().min(1),
  role: z.string().optional(),
  instrument: z.string().optional(),
})

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createGroupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, description, genre, userId, role, instrument } = parsed.data

    // Check if user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode()
    while (await db.group.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode()
    }

    const group = await db.group.create({
      data: {
        name,
        description,
        genre,
        inviteCode,
        ownerId: userId,
      },
    })

    // Add creator as owner
    await db.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: role || 'owner',
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
        role: role || 'owner',
        instrument: instrument || undefined,
        joinedAt: new Date().toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
