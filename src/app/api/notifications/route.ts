import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['chat_message', 'comment', 'track_version']),
  entityId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
})

const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
  userId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, title: true },
        },
      },
      take: 50,
    })

    return NextResponse.json(
      notifications.map((notification: typeof notifications[number]) => ({
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        entityId: notification.entityId,
        projectId: notification.projectId,
        title: notification.title,
        body: notification.body,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
        projectName: notification.project?.title,
      }))
    )
  } catch (error) {
    console.error('List notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: parsed.data,
    })

    return NextResponse.json(
      { ...notification, createdAt: notification.createdAt.toISOString() },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = markReadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if (parsed.data.all && parsed.data.userId) {
      await db.notification.updateMany({
        where: { userId: parsed.data.userId, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

    if (parsed.data.ids && parsed.data.ids.length > 0) {
      await db.notification.updateMany({
        where: { id: { in: parsed.data.ids } },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Provide ids or all+userId' }, { status: 400 })
  } catch (error) {
    console.error('Mark notifications read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
