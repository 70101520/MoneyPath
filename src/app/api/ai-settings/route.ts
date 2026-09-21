import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, encrypt } from '@/lib/security';

const localUrl = z.string().url().max(300).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'http:' || url.protocol === 'https:';
}, 'Use an HTTP or HTTPS inference endpoint');
const input = z.object({
  provider: z.enum(['OLLAMA', 'GPT_OSS', 'OPENAI']),
  ollamaUrl: localUrl,
  ollamaModel: z.string().trim().min(1).max(120),
  gptOssUrl: localUrl,
  gptOssModel: z.string().trim().min(1).max(120),
  openaiModel: z.string().trim().min(1).max(120),
  openaiApiKey: z.string().trim().max(300).optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const row = await db.aiSettings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    provider: row?.provider ?? 'OLLAMA',
    ollamaUrl: row?.ollamaUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434',
    ollamaModel: row?.ollamaModel ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:4b-q4_K_M',
    gptOssUrl: row?.gptOssUrl ?? process.env.GPT_OSS_BASE_URL ?? 'http://gpt-oss:8000/v1',
    gptOssModel: row?.gptOssModel ?? process.env.GPT_OSS_MODEL ?? 'openai/gpt-oss-20b',
    openaiModel: row?.openaiModel ?? process.env.OPENAI_MODEL ?? 'gpt-5.5',
    openaiKeyConfigured: Boolean(row?.openaiApiKey || process.env.OPENAI_API_KEY),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const body = input.parse(await request.json());
    const existing = await db.aiSettings.findUnique({ where: { userId: user.id } });
    if (body.provider === 'OPENAI' && !body.openaiApiKey && !existing?.openaiApiKey && !process.env.OPENAI_API_KEY)
      return NextResponse.json({ error: 'Add an OpenAI API key before activating cloud mode.' }, { status: 400 });
    await db.aiSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...body,
        openaiApiKey: body.openaiApiKey ? encrypt(body.openaiApiKey) : null,
      },
      update: {
        provider: body.provider,
        ollamaUrl: body.ollamaUrl,
        ollamaModel: body.ollamaModel,
        gptOssUrl: body.gptOssUrl,
        gptOssModel: body.gptOssModel,
        openaiModel: body.openaiModel,
        ...(body.openaiApiKey ? { openaiApiKey: encrypt(body.openaiApiKey) } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save AI settings' }, { status: 400 });
  }
}
