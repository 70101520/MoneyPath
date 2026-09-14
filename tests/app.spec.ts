import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('sample dashboard and all Phase 1 navigation render without client errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/demo');
  await expect(page.getByText('YOUR SAFE-TO-SPEND BALANCE', { exact: true })).toBeVisible();
  for (const section of [
    'Income',
    'Bank accounts',
    'Commitments',
    'Expenses',
    'Credit cards',
    'Card EMIs',
    'Payments',
    'Financial calendar',
    'Budgets',
    'Spending analysis',
  ]) {
    await page.getByRole('button', { name: section, exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(page.locator('.recharts-sector').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('mobile dashboard, navigation, and expense form fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.getByText('YOUR SAFE-TO-SPEND BALANCE', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.recharts-sector').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close form' }).click();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Financial calendar', exact: true }).click();
  await expect(page.locator('.mobile-agenda')).toBeVisible();
});
test('protected routes redirect and cross-origin mutations fail', async ({ page, request }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get('/api/snapshot')).status()).toBe(401);
  const res = await request.post('/api/auth', {
    headers: { origin: 'https://untrusted.invalid' },
    data: { action: 'logout' },
  });
  expect(res.status()).toBe(400);
});
test('owner authentication, persisted entry, and card repayment work end to end', async ({
  page,
  request,
}) => {
  const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
  if (url.port !== '55432' || url.pathname !== '/moneypath_test_utf8')
    throw new Error('Refusing non-test database');
  const email = 'browser-owner@test.invalid';
  const password = 'test-only-owner-password-2026';
  const origin = 'http://localhost:3100';
  await request.post('/api/auth', {
    headers: { origin },
    data: {
      action: 'register',
      email,
      password,
      name: 'Browser test',
      setupToken: process.env.SETUP_TOKEN,
    },
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  await page.getByLabel('Budget category', { exact: true }).fill('Browser budget');
  await page.getByLabel('Monthly budget (INR)', { exact: true }).fill('1234.56');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Budget saved.');
  await page.reload();
  const budgetRow = page.getByRole('row').filter({ hasText: 'browser budget' });
  await expect(budgetRow).toContainText('1,234.56');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'artifacts/budgets-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('button', { name: 'Bank accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Add account', exact: true }).click();
  const suffix = randomUUID().slice(0, 8);
  const name = 'Browser bank ' + suffix;
  await page.getByLabel('Account name').fill(name);
  await page.getByLabel('Opening balance').fill('10000');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const api = page.request;
  const send = async (data: Record<string, unknown>) => {
    const res = await api.post('/api/records', {
      headers: { origin, 'Idempotency-Key': randomUUID() },
      data,
    });
    expect(res.ok(), await res.text()).toBe(true);
    return res.json();
  };
  const snapshot = await (await api.get('/api/snapshot')).json();
  const accountId = snapshot.data.accounts.find((a: { name: string }) => a.name === name).id;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const card = await send({
    kind: 'card',
    bank: 'Test issuer',
    name: 'Browser card ' + suffix,
    creditLimit: 10000000,
    availableLimit: null,
    outstanding: 200000,
    statementAmount: 200000,
    statementPaid: 0,
    statementDate: date,
    dueDate: date,
    minimumDue: 10000,
    interestBps: 4200,
    status: 'ACTIVE',
  });
  const expenseBefore = (await (await api.get('/api/snapshot')).json()).data.expenses.length;
  await send({
    kind: 'payment',
    accountId,
    cardId: card.id,
    amount: 200000,
    date,
    type: 'STATEMENT',
  });
  const after = (await (await api.get('/api/snapshot')).json()).data;
  expect(after.cards.find((c: { id: string }) => c.id === card.id).outstanding).toBe(0);
  expect(after.accounts.find((a: { id: string }) => a.id === accountId).balance).toBe(800000);
  expect(after.expenses.length).toBe(expenseBefore);
  const exported = await api.get('/api/export');
  expect(exported.status()).toBe(200);
  expect(exported.headers()['content-type']).toContain('text/csv');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await api.get('/api/snapshot')).status()).toBe(401);
});
