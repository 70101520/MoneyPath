import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { checkOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await currentUser())) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const body = z.object({ text: z.string().trim().min(1).max(1500), language: z.string().max(20).optional() }).parse(await request.json());
    const form = new FormData(); form.set('text', body.text); form.set('language', body.language ?? 'hi');
    const response = await fetch(`${process.env.VOICE_BASE_URL ?? 'http://voice:8090'}/speak`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Speech generation failed');
    return new NextResponse(await response.arrayBuffer(), { headers: { 'Content-Type': response.headers.get('content-type') ?? 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Voice unavailable' }, { status: 400 }); }
}
