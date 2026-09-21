import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { checkOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await currentUser())) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const body = await request.formData();
    const audio = body.get('audio');
    if (!(audio instanceof File) || audio.size > 8_000_000) return NextResponse.json({ error: 'Invalid or oversized audio' }, { status: 400 });
    const form = new FormData(); form.set('audio', audio);
    const response = await fetch(`${process.env.VOICE_BASE_URL ?? 'http://voice:8090'}/transcribe`, { method: 'POST', body: form, signal: AbortSignal.timeout(120000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Transcription failed');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Voice unavailable' }, { status: 400 }); }
}
