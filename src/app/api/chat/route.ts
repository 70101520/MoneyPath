import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { checkOrigin, decrypt, encrypt } from '@/lib/security';
import { db } from '@/lib/db';
import { readData } from '@/lib/service';
import { chatReply } from '@/lib/chat';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const rows = await db.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json(
    {
      messages: rows.reverse().map((row) => ({
        id: row.id,
        role: row.role,
        content: decrypt(row.content),
        createdAt: row.createdAt,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    if (Number(request.headers.get('content-length') ?? 0) > 4096)
      return NextResponse.json({ error: 'Message is too large' }, { status: 413 });
    const body = z
        .object({
          message: z.string().trim().min(1).max(500),
          accountId: z.string().max(100).optional(),
          cardId: z.string().max(100).optional(),
        })
        .parse(await request.json()),
      previous = await db.chatMessage.findFirst({
        where: { userId: user.id, role: 'ASSISTANT' },
        orderBy: { createdAt: 'desc' },
      });
    let memory;
    if (previous) {
      try {
        memory = JSON.parse(decrypt(previous.content)!).memory;
      } catch {}
    }
    const data = await readData(user.id),
      userMessage = await db.chatMessage.create({
        data: { userId: user.id, role: 'USER', content: encrypt(body.message)! },
      }),
      reply = chatReply(data, body.message, {
        accountId: body.accountId,
        cardId: body.cardId,
        memory,
      });
    await db.chatMessage.create({
      data: {
        userId: user.id,
        role: 'ASSISTANT',
        content: encrypt(
          JSON.stringify({ answer: reply.answer, details: reply.details, memory: reply.memory }),
        )!,
      },
    });
    return NextResponse.json(
      { ...reply, userMessageId: userMessage.id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to answer' },
      { status: 400 },
    );
  }
}
