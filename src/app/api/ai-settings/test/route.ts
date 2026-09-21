import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { aiRuntime } from '@/lib/ai-settings';

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const runtime = await aiRuntime(user.id);
  try {
    const url = runtime.provider === 'OLLAMA'
      ? `${runtime.baseUrl.replace(/\/$/, '')}/api/tags`
      : runtime.provider === 'GPT_OSS'
        ? `${runtime.baseUrl.replace(/\/$/, '')}/models`
        : `${runtime.baseUrl}/models`;
    const response = await fetch(url, {
      headers: runtime.apiKey ? { Authorization: `Bearer ${runtime.apiKey}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    return NextResponse.json({ ok: true, provider: runtime.provider, model: runtime.model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider unavailable' }, { status: 400 });
  }
}
