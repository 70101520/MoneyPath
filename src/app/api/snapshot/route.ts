import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { readData } from '@/lib/service';
import { calculate } from '@/lib/finance';
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const data = await readData(user.id);
  return NextResponse.json(
    { data, summary: calculate(data) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
