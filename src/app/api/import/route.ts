import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { checkOrigin } from '@/lib/security';
import { execute } from '@/lib/service';

const row = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().positive().max(1_000_000_000),
  description: z.string().trim().max(100),
  category: z.string().trim().min(1).max(100),
  essentiality: z.enum(['MUST HAVE', 'IMPORTANT/FLEXIBLE', 'WANT']),
});
const input = z.object({
  batchId: z.uuid(),
  accountId: z.string().min(1).max(100),
  rows: z.array(row).min(1).max(100),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    if (Number(request.headers.get('content-length') ?? 0) > 262144)
      return NextResponse.json({ error: 'Import is limited to 256 KB' }, { status: 413 });
    const body = input.parse(await request.json());
    let imported = 0;
    for (const [i, r] of body.rows.entries()) {
      await execute(
        user.id,
        `${body.batchId}:import:${i}`,
        r.type === 'INCOME'
          ? {
              kind: 'income',
              amount: r.amount,
              date: r.date,
              source: 'Other Income',
              recurring: false,
              status: 'RECEIVED',
              accountId: body.accountId,
              notes: r.description,
            }
          : {
              kind: 'expense',
              amount: r.amount,
              date: r.date,
              category: r.category,
              method: 'Bank Transfer',
              essentiality: r.essentiality,
              accountId: body.accountId,
              description: r.description,
            },
      );
      imported++;
    }
    return NextResponse.json({ imported });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join('; ') },
        { status: 400 },
      );
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Import failed' },
      { status: 400 },
    );
  }
}
