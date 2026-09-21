import { db } from './db';
import { decrypt } from './security';

const words = (value: string) => new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2));
export async function relevantMemories(userId: string, question: string) {
  const query = words(question);
  const rows = await db.assistantMemory.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 100 });
  return rows.map((row) => ({ row, score: [...query].filter((word) => row.searchText.includes(word)).length }))
    .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
    .map((item) => decrypt(item.row.content)).filter((value): value is string => Boolean(value));
}
