import { test } from '@playwright/test';
import { ACCOUNTS, login, logout } from './helpers';

// Chup anh de ra soat giao dien (khong khang dinh gi). Chay: SHOTS=1 pnpm e2e shots.spec.ts
test.skip(!process.env.SHOTS, 'Chi chay khi dat SHOTS=1');

const out = (name: string) => `shots/${test.info().project.name}/${name}.png`;

async function snap(page: import('@playwright/test').Page, path: string, name: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: out(name), fullPage: true });
}

test('trang cong khai', async ({ page }) => {
  await snap(page, '/', 'home');
  await snap(page, '/experts', 'experts');
  await snap(page, '/articles', 'articles');
  await page.goto('/articles');
  const first = page.locator('a[href^="/articles/"]').first();
  if (await first.count()) {
    await first.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: out('article'), fullPage: true });
  }
  await snap(page, '/login', 'login');
  await snap(page, '/register', 'register');
});

test('khach', async ({ page }) => {
  await login(page, 'khach@webtrilieu.local');
  await snap(page, '/screening', 'screening');
  await snap(page, '/me', 'me');
  await snap(page, '/me/appointments', 'me-appointments');
  await logout(page);
});

test('chuyen gia', async ({ page }) => {
  await login(page, ACCOUNTS.expert);
  await snap(page, '/expert', 'expert');
  await snap(page, '/expert/availability', 'expert-availability');
  await snap(page, '/expert/profile', 'expert-profile');
  await logout(page);
});

test('quan tri', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await snap(page, '/admin', 'admin');
  await snap(page, '/admin/experts', 'admin-experts');
  await snap(page, '/admin/articles', 'admin-articles');
  await snap(page, '/admin/articles/new', 'admin-article-new');
  await snap(page, '/admin/users', 'admin-users');
  await logout(page);
});
