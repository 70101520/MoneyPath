import { NextResponse } from 'next/server';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkOrigin, hashPassword, verifyPassword, tokenHash } from '@/lib/security';
const input = z.object({
  action: z.enum(['login', 'register', 'logout']),
  email: z.email().max(254).optional(),
  password: z.string().min(12).max(128).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  setupToken: z.string().max(128).optional(),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const c = input.parse(await request.json());
    const jar = await cookies();
    if (c.action === 'logout') {
      const token = jar.get('moneypath_session')?.value;
      if (token) await db.session.deleteMany({ where: { id: tokenHash(token) } });
      jar.delete('moneypath_session');
      return NextResponse.json({ ok: true });
    }
    if (!c.email || !c.password)
      return NextResponse.json(
        { error: 'Email and a password of at least 12 characters are required' },
        { status: 400 },
      );
    const email = c.email.toLowerCase();
    // Global persisted bucket deliberately avoids trusting spoofable forwarding headers.
    const bucket = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740210)`;
      const prior = await tx.loginAttempt.findUnique({ where: { id: 'local-owner' } });
      return tx.loginAttempt.upsert({
        where: { id: 'local-owner' },
        create: { id: 'local-owner', count: 1, resetAt: new Date(Date.now() + 15 * 60 * 1000) },
        update:
          !prior || prior.resetAt < new Date()
            ? { count: 1, resetAt: new Date(Date.now() + 15 * 60 * 1000) }
            : { count: { increment: 1 } },
      });
    });
    if (bucket.count > 10)
      return NextResponse.json(
        { error: 'Too many attempts. Try again after 15 minutes.' },
        { status: 429 },
      );
    let user;
    if (c.action === 'register') {
      const expected = process.env.SETUP_TOKEN ?? '';
      const supplied = c.setupToken ?? '';
      if (
        expected.length < 32 ||
        expected.length !== supplied.length ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
      )
        return NextResponse.json({ error: 'Invalid setup token' }, { status: 403 });
      if (!c.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      const password = hashPassword(c.password);
      user = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740211)`;
        if (await tx.user.count()) throw new Error('Owner is already registered');
        return tx.user.create({ data: { email, password, name: c.name! } });
      });
    } else {
      user = await db.user.findUnique({ where: { email } });
      const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = verifyPassword(c.password, user?.password ?? dummy);
      if (!user || !valid)
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.loginAttempt.update({ where: { id: 'local-owner' }, data: { count: 0 } });
    await db.session.create({
      data: { id: tokenHash(token), userId: user.id, expiresAt: expires },
    });
    jar.set('moneypath_session', token, {
      httpOnly: true,
      secure: process.env.ALLOW_INSECURE_COOKIE !== 'true',
      sameSite: 'strict',
      path: '/',
      expires,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json(
      { error: 'Unable to authenticate. Check configuration or existing owner setup.' },
      { status: 400 },
    );
  }
}
