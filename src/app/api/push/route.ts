import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, encrypt, tokenHash } from '@/lib/security';
const subscription = z.object({
  endpoint: z.url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().max(256), auth: z.string().max(256) }),
});
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  return NextResponse.json(
    { publicKey: process.env.VAPID_PUBLIC_KEY ?? null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const body = subscription.parse(await request.json()),
      id = tokenHash(body.endpoint);
    await db.pushSubscription.upsert({
      where: { id },
      create: { id, userId: user.id, payload: encrypt(JSON.stringify(body))! },
      update: { userId: user.id, payload: encrypt(JSON.stringify(body))!, revokedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unable to subscribe' },
      { status: 400 },
    );
  }
}
