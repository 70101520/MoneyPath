import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { checkOrigin } from '@/lib/security';
import { commandSchema } from '@/lib/validation';
import { execute } from '@/lib/service';
import { Prisma } from '@/generated/prisma/client';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    if (Number(request.headers.get('content-length') ?? 0) > 16384)
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const requestId = z.uuid().parse(request.headers.get('idempotency-key'));
    const command = commandSchema.parse(await request.json()),
      source = request.headers.get('x-moneypath-source'),
      messageId = request.headers.get('x-moneypath-message');
    if (source && source !== 'FINANCE_ASSISTANT')
      return NextResponse.json({ error: 'Invalid record source' }, { status: 400 });
    if (messageId && !/^[a-z0-9_-]{10,100}$/i.test(messageId))
      return NextResponse.json({ error: 'Invalid conversation reference' }, { status: 400 });
    return NextResponse.json(
      await execute(user.id, requestId, command, {
        source: source === 'FINANCE_ASSISTANT' ? source : 'PORTAL',
        conversationMessageId: messageId ?? undefined,
        confirmedByUser: source === 'FINANCE_ASSISTANT',
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ') },
        { status: 400 },
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return NextResponse.json(
        {
          error:
            error.code === 'P2025'
              ? 'Record not found'
              : 'Transaction could not be applied; refresh and retry',
        },
        { status: 400 },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save record' },
      { status: 400 },
    );
  }
}
