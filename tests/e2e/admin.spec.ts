import { expect, test } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-e2e';

test.describe('Admin', () => {
  test('hub, login, navigation and APIs', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: /Painel administrativo/i })).toBeVisible();
    await expect(page.getByLabel(/Senha admin/i)).toBeVisible({ timeout: 15000 });

    const loginVisible = await page.getByLabel(/Senha admin/i).isVisible();
    if (loginVisible) {
      await page.getByLabel(/Senha admin/i).fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('link', { name: /Leads e conformidade/i })).toBeVisible({
        timeout: 10000,
      });
    }

    expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);

    await page.getByRole('navigation').getByRole('link', { name: 'Leads' }).click();
    await expect(page.getByRole('heading', { name: /Leads e notas/i })).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Consultas' }).click();
    await expect(page.getByRole('heading', { name: /Últimos sites consultados/i })).toBeVisible();

    const sessionRes = await page.request.get(`${BASE}/api/admin/session`);
    expect(sessionRes.ok()).toBeTruthy();
    expect((await sessionRes.json()).authenticated).toBe(true);

    const consultRes = await page.request.get(`${BASE}/api/admin/consultations?limit=5`);
    if (consultRes.status() === 503) {
      await expect(page.getByText(/Banco não configurado/i)).toBeVisible();
    } else {
      expect(consultRes.ok()).toBeTruthy();
    }
  });
});