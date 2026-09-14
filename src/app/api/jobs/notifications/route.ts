import { timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readData } from '@/lib/service';
import { planningNotifications } from '@/lib/decision';
import { decrypt } from '@/lib/security';

const same = (a: string, b: string) =>
  a.length === b.length && a.length >= 32 && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function delivered(userId: string, notificationKey: string, channel: 'EMAIL' | 'PUSH') {
  return (
    (
      await db.notificationDelivery.findUnique({
        where: { userId_notificationKey_channel: { userId, notificationKey, channel } },
      })
    )?.status === 'SENT'
  );
}
export async function POST(request: Request) {
  const expected = process.env.JOB_SECRET ?? '',
    supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!same(expected, supplied))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const smtp =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        })
      : null;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:owner@localhost',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  let sent = 0,
    failed = 0;
  for (const user of await db.user.findMany()) {
    const items = planningNotifications(await readData(user.id));
    for (const item of items) {
      const key = `${new Date().toISOString().slice(0, 10)}:${item.id}`;
      if (smtp && process.env.EMAIL_FROM && !(await delivered(user.id, key, 'EMAIL'))) {
        try {
          await smtp.sendMail({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: `MoneyPath: ${item.title}`,
            text: item.detail,
          });
          await record(user.id, key, 'EMAIL', 'SENT');
          sent++;
        } catch (e) {
          await record(user.id, key, 'EMAIL', 'FAILED', e);
          failed++;
        }
      }
      for (const sub of await db.pushSubscription.findMany({
        where: { userId: user.id, revokedAt: null },
      })) {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) break;
        if (await delivered(user.id, key + ':' + sub.id, 'PUSH')) continue;
        try {
          await webpush.sendNotification(
            JSON.parse(decrypt(sub.payload)!),
            JSON.stringify({ title: item.title, body: item.detail, url: '/' + item.section }),
          );
          await record(user.id, key + ':' + sub.id, 'PUSH', 'SENT');
          sent++;
        } catch (e) {
          await record(user.id, key + ':' + sub.id, 'PUSH', 'FAILED', e);
          failed++;
        }
      }
    }
  }
  return NextResponse.json({ sent, failed });
}
async function record(
  userId: string,
  notificationKey: string,
  channel: 'EMAIL' | 'PUSH',
  status: 'SENT' | 'FAILED',
  error?: unknown,
) {
  await db.notificationDelivery.upsert({
    where: { userId_notificationKey_channel: { userId, notificationKey, channel } },
    create: {
      userId,
      notificationKey,
      channel,
      status,
      error: error instanceof Error ? error.message.slice(0, 300) : null,
    },
    update: {
      status,
      attemptedAt: new Date(),
      error: error instanceof Error ? error.message.slice(0, 300) : null,
    },
  });
}
