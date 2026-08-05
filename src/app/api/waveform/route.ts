import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';

const execFileAsync = promisify(execFile);
const CACHE_DIR = join(process.cwd(), 'uploads', 'waveform-cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

function getCachePath(audioPath: string): string {
  try {
    const stat = statSync(audioPath);
    const hash = `${stat.size}-${stat.mtimeMs}`;
    return join(CACHE_DIR, `${hash}.json`);
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const audioUrl = searchParams.get('audio');
  const samples = parseInt(searchParams.get('samples') || '200', 10);

  if (!audioUrl) {
    return NextResponse.json({ error: 'Missing audio parameter' }, { status: 400 });
  }

  // Resolve the file path from the URL
  // audioUrl is like /api/uploads/audio/filename.mp3
  // The file is stored in uploads/audio/filename.mp3
  const urlPath = audioUrl.replace(/^\/api\/uploads\//, '');
  const filePath = join(process.cwd(), 'uploads', urlPath);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
  }

  // Check cache
  const cachePath = getCachePath(filePath);
  if (cachePath && existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
      // If cached sample count matches or is higher, return it (downsample on client if needed)
      if (cached.samples >= samples) {
        return NextResponse.json(cached);
      }
    } catch {
      // Cache corrupt, regenerate
    }
  }

  try {
    // Use ffmpeg to extract raw PCM data (mono, 16-bit signed LE)
    const { stdout } = await execFileAsync('ffmpeg', [
      '-i', filePath,
      '-ac', '1',           // mono
      '-ar', '8000',        // 8kHz sample rate (enough for waveform)
      '-f', 's16le',        // 16-bit signed LE PCM
      '-v', 'error',        // suppress stderr
      'pipe:1',
    ], {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 15000, // 15 second timeout
      encoding: 'buffer', // critical: get raw Buffer, not String
    });

    // Parse PCM data into waveform samples
    const pcmData = new Int16Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 2);
    const blockSize = Math.floor(pcmData.length / samples);
    const waveformData: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = blockSize * i;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(pcmData[start + j] || 0);
      }
      waveformData.push(blockSize > 0 ? sum / blockSize / 32768 : 0); // normalize to 0-1
    }

    // Normalize to max = 1
    const max = Math.max(...waveformData, 0.001);
    const normalized = waveformData.map((v) => v / max);

    // Cache result
    if (cachePath) {
      try {
        writeFileSync(cachePath, JSON.stringify({ samples: normalized, sampleCount: samples }));
      } catch {
        // Cache write failure, not critical
      }
    }

    return NextResponse.json({ samples: normalized, sampleCount: samples });
  } catch (error) {
    // ffmpeg might not be available, or file is corrupted
    console.error('Waveform generation error:', error);

    // Fallback: return generated placeholder data so the UI isn't stuck
    const placeholder: number[] = [];
    for (let i = 0; i < samples; i++) {
      // Generate a gentle random waveform pattern
      const t = i / samples;
      placeholder.push(
        0.3 + 0.4 * Math.sin(t * Math.PI * 12) * Math.sin(t * Math.PI * 3) + 0.2 * Math.random()
      );
    }
    const maxP = Math.max(...placeholder, 0.001);
    return NextResponse.json({ samples: placeholder.map((v) => v / maxP), sampleCount: samples });
  }
}
