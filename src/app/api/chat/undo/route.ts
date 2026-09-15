import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { checkOrigin } from '@/lib/security';
import { undoLatestAssistantAction } from '@/lib/service';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    return NextResponse.json(await undoLatestAssistantAction(user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to undo' },
      { status: 400 },
    );
  }
}
