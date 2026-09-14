import { describe, expect, it } from 'vitest';
import { explainFinance } from './assistant';
import { sampleData } from './sample';
describe('constrained finance assistant', () => {
  it('answers only from deterministic results', () => {
    const data = sampleData('2026-09-14'),
      answer = explainFinance(data, 'SPEND', 9_999_999);
    expect(answer.title).toContain('Above');
    expect(answer.answer).toContain('safe-to-spend');
  });
  it('requires a stored goal for goal guidance', () => {
    expect(explainFinance(sampleData('2026-09-14'), 'GOAL').title).toBe('Information Required');
  });
});
