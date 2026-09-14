import { cookies } from 'next/headers';
import { db } from './db';
import { tokenHash } from './security';
export async function currentUser() {
  const token = (await cookies()).get('moneypath_session')?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: tokenHash(token) },
    include: { user: true },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}
