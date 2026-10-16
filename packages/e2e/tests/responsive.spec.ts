import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

const PUBLIC = ['/', '/experts', '/articles', '/login', '/register', '/screening', '/tu-danh-gia', '/ve-chung-toi', '/forgot-password', '/experts?sort=soonest&mode=online'];
const overflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = (name: string) => name.replace(/[^a-zA-Z0-9-]/g, '_');

for (const path of PUBLIC) {
  test(`khong tran ngang: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/shots/${test.info().project.name}${shot(path) || '_home'}.png`, fullPage: true });
  });
}

test('khu vuc admin dung duoc tren man hinh nay', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  for (const path of ['/admin', '/admin/articles', '/admin/users', '/admin/questions', '/admin/reviews']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await overflow(page), path).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/shots/${test.info().project.name}-admin${shot(path)}.png` });
  }
});
