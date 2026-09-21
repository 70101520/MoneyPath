import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, decrypt, encrypt } from '@/lib/security';

const forbidden = /(?:₹|\d|balance|debt|loan|salary|income|expense|transaction|account|card|emi|due|payment|saving|investment|amount)/i;
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const rows = await db.assistantMemory.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 50 });
  return NextResponse.json({ memories: rows.map((row) => ({ id: row.id, content: decrypt(row.content), updatedAt: row.updatedAt })) });
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const content = z.string().trim().min(3).max(300).parse((await request.json()).content);
    if (forbidden.test(content)) return NextResponse.json({ error: 'Balances, debts, transactions and other financial values belong in MoneyPath records, not AI memory.' }, { status: 400 });
    const row = await db.assistantMemory.create({ data: { userId: user.id, content: encrypt(content)!, searchText: content.toLowerCase() } });
    return NextResponse.json({ id: row.id });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save memory' }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request); const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const id = z.string().max(100).parse((await request.json()).id);
    await db.assistantMemory.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete memory' }, { status: 400 }); }
}
