import { redirect, notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { readData } from '@/lib/service';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
const sections = [
  'dashboard',
  'income',
  'accounts',
  'commitments',
  'expenses',
  'cards',
  'emi',
  'payments',
  'calendar',
  'settings',
];
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  const user = await currentUser();
  if (!user) redirect('/login');
  const data = await readData(user.id);
  return <Workspace data={data} section={section} />;
}
