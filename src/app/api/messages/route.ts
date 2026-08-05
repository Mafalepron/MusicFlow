import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const entityTypes = ['project', 'track'] as const

const sendMessageSchema = z.object({
  entityType: z.enum(entityTypes),
  entityId: z.string().min(1, 'Entity ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  text: z.string().min(1, 'Message text is required').max(5000),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId query params are required' },
        { status: 400 }
      )
    }

    if (!entityTypes.includes(entityType as typeof entityTypes[number])) {
      return NextResponse.json(
        { error: 'entityType must be "project" or "track"' },
        { status: 400 }
      )
    }

    const messages = await db.message.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    })

    return NextResponse.json(
      messages.map((message: typeof messages[number]) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('List messages error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { entityType, entityId, userId, text } = parsed.data

    const message = await db.message.create({
      data: { entityType, entityId, userId, text },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    })

    return NextResponse.json(
      {
        ...message,
        createdAt: message.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
