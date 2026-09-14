import { describe, expect, it } from 'vitest';
import { explainFinance } from './assistant';
import { sampleData } from './sample';
import { emergencyAdjustment, financialActionPlan } from './guidance';
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
  it('creates a sequenced action plan from recorded values', () => {
    const plan = financialActionPlan(sampleData('2026-09-14'));
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.actions.some((action) => action.section === 'debt-plan')).toBe(true);
  });
  it('uses emergency reserve before flexible sources', () => {
    const plan = emergencyAdjustment(sampleData('2026-09-14'), 700000);
    expect(plan.steps[0]).toContain('emergency reserve');
    expect(plan.steps.length).toBeGreaterThan(1);
    expect(plan.uncovered).toBe(0);
  });
});
