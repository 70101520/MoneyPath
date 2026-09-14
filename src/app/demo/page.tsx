import { Workspace } from '@/components/workspace';
import { sampleData } from '@/lib/sample';
export const dynamic = 'force-dynamic';
export default function Demo() {
  return <Workspace data={sampleData()} section="dashboard" demo />;
}
