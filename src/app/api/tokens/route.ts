import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, tokenHash } from '@/lib/security';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const tokens = await db.apiToken.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ tokens }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const { label } = z
      .object({ label: z.string().trim().min(1).max(50) })
      .parse(await request.json());
    const token = 'mp_' + randomBytes(32).toString('base64url'),
      expiresAt = new Date(Date.now() + 90 * 86400000);
    await db.apiToken.create({ data: { id: tokenHash(token), userId: user.id, label, expiresAt } });
    return NextResponse.json({ token, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unable to create token' },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const { id } = z.object({ id: z.string().length(64) }).parse(await request.json());
    const result = await db.apiToken.updateMany({
      where: { id, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count)
      return NextResponse.json({ error: 'Active token not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unable to revoke token' },
      { status: 400 },
    );
  }
}
