import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio')

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.wma': 'audio/x-ms-wma',
  '.webm': 'audio/webm',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    const filename = pathSegments.join('/')
    const filePath = path.join(AUDIO_DIR, filename)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      )
    }

    const ext = path.extname(filename).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    const fileBuffer = readFileSync(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=604800',
      },
    })
  } catch (error) {
    console.error('Serve audio error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
