import { expect, type Page } from '@playwright/test';

export const ACCOUNTS = {
  admin: 'admin@webtrilieu.local',
  expert: 'bsminh@webtrilieu.local',
} as const;

export const seedPassword = (): string => {
  const p = process.env.SEED_PASSWORD;
  if (!p) throw new Error('Can SEED_PASSWORD trong .env');
  return p;
};

export async function login(page: Page, email: string, password = seedPassword()) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.request.post('/api/auth/logout', { headers: { origin: 'http://localhost:3000' } });
  await page.context().clearCookies();
}

/** Tra loi moi cau hoi bang lua chon dau tien (khong chon dap an nguy co). */
export async function answerFirstOptions(page: Page) {
  await page.locator('fieldset').first().waitFor();
  await page.waitForLoadState('networkidle');
  const sets = await page.locator('fieldset').all();
  for (const fs of sets) {
    await fs.locator('input').first().check();
  }
  // Cau tra loi phai con nguyen sau khi trang on dinh (khong bi reset boi re-render)
  await page.waitForTimeout(500);
  for (const fs of sets) {
    await expect(fs.locator('input').first()).toBeChecked();
  }
  for (const ta of await page.locator('textarea').all()) {
    await ta.fill('Noi dung kiem thu e2e');
  }
}
