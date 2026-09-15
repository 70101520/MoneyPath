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
  it('prepares card purchases and payments without treating payment as an expense', () => {
    const data = sampleData('2026-09-14'),
      context = { accountId: data.accounts[0].id, cardId: data.cards[0].id };
    expect(
      chatReply(data, 'credit card se 2000 grocery purchase kiya', context).draft,
    ).toMatchObject({
      kind: 'expense',
      method: 'Credit Card',
      amount: 200000,
      cardId: data.cards[0].id,
    });
    const payment = chatReply(data, 'card ka 2000 payment kiya', context);
    expect(payment.draft).toMatchObject({ kind: 'payment', amount: 200000 });
    expect(payment.details.join(' ')).toContain('expense nahi hai');
  });
  it('uses conversational purchase memory for amount and funding follow-ups', () => {
    const data = sampleData('2026-09-14'),
      context = { accountId: data.accounts[0].id, cardId: data.cards[0].id },
      first = chatReply(data, '25k mobile le sakta hu?', context),
      second = chatReply(data, '20k ka hua to?', { ...context, memory: first.memory }),
      third = chatReply(data, 'card se lu to?', { ...context, memory: second.memory });
    expect(first.memory).toMatchObject({ intent: 'PURCHASE', amount: 2500000 });
    expect(second.memory).toMatchObject({ amount: 2000000 });
    expect(third.memory).toMatchObject({ amount: 2000000, method: 'CARD' });
  });
  it('explains risk and reports a database-derived safe purchase ceiling', () => {
    const data = sampleData('2026-09-14');
    const risk = chatReply(data, 'mera risk high kyu hai?');
    expect(risk.details).toEqual(expect.arrayContaining([expect.stringMatching(/^[+-]?\d+:/)]));
    const ceiling = chatReply(data, 'mobile maximum kitne ka le sakta hu?');
    expect(ceiling.answer).toContain('safe cash purchase ceiling');
    expect(ceiling.details.join(' ')).toContain('available card limit');
  });
  it('answers misspelled Hinglish current-status questions without falling back to entry help', () => {
    const data = sampleData('2026-09-14');
    data.cards = data.cards.map((card) => ({ ...card, detailsComplete: false }));
    for (const question of [
      'ky abhi mera current finaceial status sahi hi?',
      'mera finanical status abhi sahi hi ya nehi?',
    ]) {
      const reply = chatReply(data, question);
      expect(reply.answer).toContain('recorded position ko attention chahiye');
      expect(reply.answer).not.toContain('I understood this as');
      expect(reply.details.join(' ')).toContain('3 credit cards');
      expect(reply.details.join(' ')).not.toContain('Axis 1: review');
    }
  });
  it('requires confirmation for emergency expense and supports cancellation without a draft', () => {
    const data = sampleData('2026-09-14'),
      reply = chatReply(data, 'emergency medical expense 8000 hua', {
        accountId: data.accounts[0].id,
      });
    expect(reply.draft).toMatchObject({ kind: 'expense', amount: 800000 });
    expect(reply.confirmation).toBeTruthy();
    expect(chatReply(data, 'cancel rehne do').draft).toBeUndefined();
  });
});
