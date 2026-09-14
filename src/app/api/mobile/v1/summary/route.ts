import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tokenHash } from '@/lib/security';
import { readData } from '@/lib/service';
import { calculate } from '@/lib/finance';
import { paymentPriority, planningNotifications } from '@/lib/decision';

export async function GET(request: Request) {
  const raw = request.headers.get('authorization')?.match(/^Bearer (mp_[A-Za-z0-9_-]+)$/)?.[1];
  if (!raw) return NextResponse.json({ error: 'Valid bearer token required' }, { status: 401 });
  const token = await db.apiToken.findUnique({ where: { id: tokenHash(raw) } });
  if (!token || token.revokedAt || token.expiresAt <= new Date())
    return NextResponse.json({ error: 'Token expired or revoked' }, { status: 401 });
  await db.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  const data = await readData(token.userId),
    s = calculate(data),
    priority = paymentPriority(data).ranked.slice(0, 5);
  return NextResponse.json(
    {
      asOf: s.asOf,
      safeToSpend: s.safe,
      risk: s.risk,
      cash: s.cash,
      totalDebt: s.totalDebt,
      investmentValue: s.investmentValue,
      upcoming: priority,
      notifications: planningNotifications(data).slice(0, 10),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
