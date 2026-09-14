import { describe, expect, it } from 'vitest';
import { chatReply, parseAmount } from './chat';
import { sampleData } from './sample';

describe('MoneyPath conversational finance', () => {
  it('understands common Indian amount forms', () => {
    expect(parseAmount('price 25k')).toBe(2_500_000);
    expect(parseAmount('borrow 2 lakh')).toBe(20_000_000);
    expect(parseAmount('spent ₹1,234.50')).toBe(123450);
  });
  it('refuses an unaffordable purchase with exact consequences', () => {
    const reply = chatReply(sampleData('2026-09-14'), 'Can I buy a phone price 50000?');
    expect(reply.answer).toMatch(/^No/);
    expect(reply.details.join(' ')).toContain('safe-to-spend');
    expect(reply.draft).toBeUndefined();
  });
  it('prepares salary and friend borrowing records for confirmation', () => {
    const data = sampleData('2026-09-14'),
      accountId = data.accounts[0].id;
    expect(chatReply(data, 'Today salary 55k credited', { accountId }).draft).toMatchObject({
      kind: 'income',
      amount: 5_500_000,
      accountId,
    });
    expect(chatReply(data, 'Friend se 10000 udhar liya', { accountId }).draft).toMatchObject({
      kind: 'personalTransfer',
      direction: 'PAYABLE',
      amount: 1_000_000,
      accountId,
    });
  });
  it('warns before preparing a card cash advance', () => {
    const data = sampleData('2026-09-14'),
      reply = chatReply(data, 'credit card se cash 5000 nikalna hai', {
        accountId: data.accounts[0].id,
        cardId: data.cards[0].id,
      });
    expect(reply.answer).toContain('do not recommend');
    expect(reply.draft).toMatchObject({ kind: 'cashAdvance', amount: 500000 });
  });
});
