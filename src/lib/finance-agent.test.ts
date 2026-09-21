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
    delete process.env.GPT_OSS_BASE_URL;
    delete process.env.GPT_OSS_MODEL;
  });

  it('routes the environment GPT-OSS provider through its OpenAI-compatible endpoint', async () => {
    process.env.AI_PROVIDER = 'GPT_OSS';
    process.env.GPT_OSS_BASE_URL = 'http://gpt-oss.test/v1';
    process.env.GPT_OSS_MODEL = 'gpt-oss:20b';
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        queries: ['snapshot'], primaryQuery: 'snapshot', mutation: 'none',
        accountQuery: '', cardQuery: '', needsClarification: '',
        answer: 'Verified snapshot.', details: [],
      }) } }] }),
    } as Response);
    vi.stubGlobal('fetch', fetch);
    await financeAgentReply(sampleData('2026-09-14'), 'status batao');
    expect(fetch.mock.calls[0][0]).toBe('http://gpt-oss.test/v1/chat/completions');
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('gpt-oss:20b');
  });

  it('keeps a casual greeting conversational instead of forcing a savings snapshot', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({
      queries: ['conversation'], primaryQuery: 'conversation', mutation: 'none',
      accountQuery: '', cardQuery: '', needsClarification: '',
      answer: 'Haan dost, main yahin hoon. Batao kya baat karni hai?', details: [],
    })));
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'Hi dost');
    expect(reply.answer).toContain('dost');
    expect(reply.answer).not.toContain('Bank savings');
  });

  it('protects a voice greeting from a weak model financial-summary misroute', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'Hai, dost.');
    expect(reply.answer).toBe('Haan dost, main yahin hoon. Batao, aaj kis cheez mein help chahiye?');
    expect(reply.details).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps model-generated casual conversation clean without finance detail bullets', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({
      queries: ['conversation'], primaryQuery: 'conversation', mutation: 'none',
      accountQuery: '', cardQuery: '', needsClarification: '',
      answer: 'Main bilkul theek dost, tum kaise ho?',
      details: ['Tumhari baat sunne ke liye main hoon.', 'Batao kya help chahiye?'],
    })));
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'Aaj tum kaise ho dost?');
    expect(reply.answer).toContain('theek dost');
    expect(reply.details).toEqual([]);
  });

  it('grounds an explicit credit-card question in card totals even when the model selects cash', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({
      queries: ['available_cash'], primaryQuery: 'available_cash', mutation: 'none',
      accountQuery: '', cardQuery: '', needsClarification: '',
      answer: 'Wrong cash answer.', details: [],
    })));
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'mera kitna credit card ka payment bacha hi');
    expect(reply.answer).toContain('total recorded credit-card debt');
    expect(reply.answer).toContain('billed payment');
    expect(reply.answer).not.toContain('Wrong cash answer');
    expect(reply.details).toEqual([]);
  });

  it('lets the model plan while deterministic engines provide every financial number', async () => {
    expect(extractedAmount('Mera friend ₹2000 maang raha hai, de du ya nahi?')).toBe(200000);
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    const fetch = vi.fn().mockResolvedValueOnce(
      response({
        queries: ['cash_outflow', 'priorities'],
        primaryQuery: 'cash_outflow',
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
          primaryQuery: 'snapshot',
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
          primaryQuery: 'cards',
          mutation: 'card_balance_update',
          accountQuery: '',
          cardQuery: 'HDFC',
          needsClarification: '',
          answer: 'HDFC balance update draft ready hai.',
          details: ['ICICI card mein ₹4,554 add ho gaya.'],
        }),
      ),
    );
    const data = sampleData('2026-09-14');
    data.cards[2].name = 'ICICI Platinum';
    data.cards[2].bank = 'ICICI';
    const reply = await financeAgentReply(
      data,
      'icic ka crdidt card ka current due 4554 update karo',
      { cardId: 'card-1' },
    );
    expect(reply.draft).toMatchObject({
      kind: 'updateCard',
      id: 'card-3',
      outstanding: 455400,
      statementAmount: 455400,
    });
    expect(reply.confirmation).toContain('₹4,554');
    expect(reply.details).toEqual([]);
  });

  it('renders savings as deterministic account, investment and safe-money totals', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        response({
          queries: ['savings'],
          primaryQuery: 'savings',
          mutation: 'none',
          accountQuery: '',
          cardQuery: '',
          needsClarification: '',
          answer: 'Wrong model summary.',
          details: [],
        }),
      ),
    );
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'meri bachat kitni hai?');
    expect(reply.answer).toContain('HDFC');
    expect(reply.answer).toContain('Long-term savings');
    expect(reply.answer).toContain('combined recorded savings/assets');
    expect(reply.answer).toContain('safe-to-spend');
  });
});
