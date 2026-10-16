import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test('header bao mat tren moi trang, khong lo X-Powered-By', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-powered-by']).toBeUndefined();
  const csp = h['content-security-policy'] ?? '';
  for (const d of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "frame-src 'none'", "base-uri 'self'"]) {
    expect(csp, d).toContain(d);
  }
  // API qua proxy cung gui header an toan (helmet)
  const api = await request.get('/api/health');
  expect(api.headers()['x-content-type-options']).toBe('nosniff');
});

test('CSP khong chan tai nguyen hop le cua trang (ke ca khung xem truoc bai viet va socket)', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/content security policy|refused to (load|connect|frame|execute)/i.test(m.text())) violations.push(m.text());
  });
  for (const p of ['/', '/experts', '/articles', '/screening', '/login']) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
  }
  await login(page, ACCOUNTS.admin);
  await page.goto('/admin/articles/new');
  await page.locator('#content').fill('<h2>Xem truoc CSP</h2><p>noi dung</p>');
  await expect(page.frameLocator('iframe[title="Xem trước bài viết"]').getByText('Xem truoc CSP')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(violations).toEqual([]);
});

test('khung xem truoc bai viet khong chay script va khong cham duoc trang quan tri', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await page.goto('/admin/articles/new');
  await page.locator('#content').fill('<img src=x onerror="parent.__pwned=1"><script>parent.__pwned=1</script><p>an toan</p>');
  const frame = page.frameLocator('iframe[title="Xem trước bài viết"]');
  await expect(frame.getByText('an toan')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('doi du lieu khong co Origin hop le bi tu choi ke ca qua proxy cua web', async ({ request }) => {
  // Khong Origin + co cookie phien (kieu CSRF cua trinh duyet) => 403; khong cookie (client Bearer/mobile) thi duoc phep.
  const noOrigin = await request.post('/api/auth/logout', { data: {}, headers: { cookie: 'wtl_session=khong-hop-le' } });
  expect(noOrigin.status()).toBe(403);
  const evil = await request.post('/api/auth/login', {
    data: { email: 'a@b.test', password: 'x'.repeat(12) },
    headers: { origin: 'https://evil.example' },
  });
  expect(evil.status()).toBe(403);
});

test('trang rieng tu khong lo noi dung khi chua dang nhap', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const page = await ctx.newPage();
  for (const p of ['/me', '/expert', '/admin', '/admin/users', '/admin/audit']) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  expect((await page.request.get('/api/admin/audit-logs')).status()).toBe(401);
  await ctx.close();
});
