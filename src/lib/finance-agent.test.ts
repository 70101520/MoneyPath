import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleData } from './sample';
import { extractedAmount, financeAgentReply } from './finance-agent';

function response(output: object) {
  return { ok: true, json: async () => ({ output_text: JSON.stringify({ calculations: [], ...output }) }) } as Response;
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

  it('returns the model-composed answer without replacing it with a canned card summary', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({
      queries: ['savings', 'cards', 'priorities'], primaryQuery: 'priorities', mutation: 'none',
      accountQuery: '', cardQuery: '', needsClarification: '',
      answer: 'Savings aur small card balances compare karke SBI aur HDFC pehle close kar sakte ho.', details: [],
    })));
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'saving se kaunse small card payment kar sakta hu?');
    expect(reply.answer).toContain('SBI aur HDFC');
    expect(reply.answer).not.toContain('total recorded credit-card debt');
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
    expect(finalRequest.input).toContain('Hinglish in Latin/Roman letters');
    expect(finalRequest.instructions).toContain('Never invent');
  });

  it('removes a stray structured-output brace from otherwise valid model text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({
      queries: ['snapshot'], primaryQuery: 'snapshot', mutation: 'none',
      accountQuery: '', cardQuery: '', needsClarification: '',
      answer: 'Abhi safe-to-spend amount nahi hai.}', details: [],
    })));
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'abhi invest kar sakta hu?');
    expect(reply.answer).toBe('Abhi safe-to-spend amount nahi hai.');
  });

  it('executes requested arithmetic in the deterministic calculator before the final answer', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({
        queries: ['savings', 'cards'], primaryQuery: 'priorities', mutation: 'none',
        accountQuery: '', cardQuery: '', needsClarification: '',
        answer: 'Calculation required.', details: [],
        calculations: [{ label: 'balance after payment', operation: 'subtract', operands: ['₹1,07,850', '₹20,000'] }],
      }))
      .mockResolvedValueOnce(response({
        queries: ['savings', 'cards'], primaryQuery: 'priorities', mutation: 'none',
        accountQuery: '', cardQuery: '', needsClarification: '',
        answer: '₹20,000 payment ke baad ₹87,850 bachega.', details: [], calculations: [],
      }));
    vi.stubGlobal('fetch', fetch);
    const reply = await financeAgentReply(sampleData('2026-09-14'), '20000 card payment ke baad kitna bachega?');
    expect(reply.answer).toContain('₹87,850');
    expect(fetch).toHaveBeenCalledTimes(2);
    const secondRequest = JSON.parse(fetch.mock.calls[1][1].body);
    expect(secondRequest.input).toContain('verifiedCalculations');
    expect(secondRequest.input).toContain('₹87,850');
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

  it('uses the account explicitly named in the current message over a wrong model account', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_PROVIDER = 'openai';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({
      queries: ['snapshot'], primaryQuery: 'snapshot', mutation: 'account_deposit',
      accountQuery: 'HDFC', cardQuery: '', needsClarification: '',
      answer: 'Draft ready.', details: [],
    })));
    const data = sampleData('2026-09-14');
    data.accounts.push({ id: 'bank-sbi', name: 'SBI Savings', kind: 'BANK', balance: 2700000, spendable: true });
    const reply = await financeAgentReply(data, 'ok 10k add karo SBI me');
    expect(reply.draft).toMatchObject({ kind: 'income', amount: 1000000, accountId: 'bank-sbi' });
    expect(reply.confirmation).toContain('SBI Savings');
    expect(reply.confirmation).not.toContain('HDFC');
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

  it('lets the model explain verified savings facts in the user’s requested context', async () => {
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
          answer: 'HDFC aur Long-term savings mila kar recorded savings hain; safe-to-spend alag reserve calculation hai.',
          details: [],
        }),
      ),
    );
    const reply = await financeAgentReply(sampleData('2026-09-14'), 'meri bachat kitni hai?');
    expect(reply.answer).toContain('HDFC');
    expect(reply.answer).toContain('Long-term savings');
    expect(reply.answer).toContain('recorded savings');
    expect(reply.answer).toContain('safe-to-spend');
  });
});
