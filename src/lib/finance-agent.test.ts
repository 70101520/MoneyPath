import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleData } from './sample';
import { extractedAmount, financeAgentReply } from './finance-agent';

function response(output: object) {
  return { ok: true, json: async () => ({ output_text: JSON.stringify(output) }) } as Response;
}

describe('general reasoning finance agent orchestration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  it('lets the model plan while deterministic engines provide every financial number', async () => {
    expect(extractedAmount('Mera friend ₹2000 maang raha hai, de du ya nahi?')).toBe(200000);
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    const fetch = vi.fn().mockResolvedValueOnce(
      response({
        queries: ['cash_outflow', 'priorities'],
        mutation: 'none',
        accountQuery: '',
        cardQuery: '',
        needsClarification: '',
        answer: 'Caution: abhi dena safe nahi lagta.',
        details: ['Recorded cash plan check kiya gaya.'],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const reply = await financeAgentReply(
      sampleData('2026-09-14'),
      'Mera friend ₹2000 maang raha hai, de du ya nahi?',
      { accountId: 'bank-1' },
    );
    expect(reply.answer).toContain('Caution');
    expect(reply.draft).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    const finalRequest = JSON.parse(fetch.mock.calls[0][1].body);
    expect(finalRequest.input).toContain('cashOutflow');
    expect(finalRequest.input).toContain('priorities');
    expect(finalRequest.instructions).toContain('Never invent');
  });

  it('returns a proposed mutation but never executes it without the existing confirmation flow', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        response({
          queries: ['snapshot'],
          mutation: 'account_deposit',
          accountQuery: 'HDFC',
          cardQuery: '',
          needsClarification: '',
          answer: 'Deposit prepare kar diya.',
          details: ['Save karne se pehle confirm karein.'],
        }),
      ),
    );
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'HDFC me 2000 add karo');
    expect(reply.draft).toMatchObject({ kind: 'income', amount: 200000, accountId: 'bank-1' });
    expect(reply.confirmation).toContain('Confirm');
  });

  it('prepares a named card balance correction instead of treating it as income', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        response({
          queries: ['cards'],
          mutation: 'card_balance_update',
          accountQuery: '',
          cardQuery: 'HDFC',
          needsClarification: '',
          answer: 'HDFC balance update draft ready hai.',
          details: [],
        }),
      ),
    );
    const reply = await financeAgentReply(
      sampleData('2026-09-14'),
      'HDFC credit card ka current due 4554 update karo',
    );
    expect(reply.draft).toMatchObject({
      kind: 'updateCard',
      id: 'card-3',
      outstanding: 455400,
      statementAmount: 455400,
    });
    expect(reply.confirmation).toContain('₹4,554');
  });
});
