import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ACCOUNTS, login, logout } from './helpers';

// Thu muc anh tai len cua API chay tren cung may (mac dinh <goc repo>/data/uploads); test tu don anh no da tai len.
const uploadDir = process.env.UPLOAD_DIR ?? join(fileURLToPath(new URL('../../../data/uploads', import.meta.url)));
const uploaded: string[] = [];

const ORIGIN = { origin: 'http://localhost:3000' };
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test.describe('Khoi phuc mat khau va tai anh', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'Luong quan tri chay tren desktop');
  test.describe.configure({ mode: 'serial' });

  const email = `e2e.reset.${Date.now()}@example.test`;
  const first = 'Matkhau1e2eTest';
  const second = 'Matkhau2e2eMoi';

  test('admin cap mat khau tam; nguoi dung bi buoc doi mat khau roi moi vao duoc', async ({ page }) => {
    const reg = await page.request.post('/api/auth/register', { data: { email, password: first, fullName: 'E2E Reset' }, headers: ORIGIN });
    expect(reg.status()).toBe(201);
    await logout(page);

    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/users');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: `Cấp mật khẩu tạm cho ${email}` }).click();
    const temp = (await page.getByTestId('temp-password').textContent())?.trim() ?? '';
    expect(temp).toMatch(/^[A-Za-z0-9]{14}$/);
    await logout(page);

    // Mat khau cu khong con dung; mat khau tam dung duoc nhung bi giu o man hinh doi mat khau
    expect((await page.request.post('/api/auth/login', { data: { email, password: first }, headers: ORIGIN })).status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(temp);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Bạn đang dùng mật khẩu tạm')).toBeVisible();
    expect((await page.request.get('/api/cases/mine')).status()).toBe(403);

    await page.getByLabel('Mật khẩu hiện tại').fill(temp);
    await page.getByLabel('Mật khẩu mới').fill(second);
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByText('Bạn đang dùng mật khẩu tạm')).toBeHidden();
    expect((await page.request.get('/api/cases/mine')).status()).toBe(200);
    await logout(page);
  });

  test.afterAll(async ({ browser }) => {
    // Don dep: xoa anh da tai len, khoa tai khoan thu (giong cach flow.spec don dep)
    for (const url of uploaded) await rm(join(uploadDir, url.split('/').pop()!), { force: true });
    const ctx = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const page = await ctx.newPage();
    try {
      await login(page, ACCOUNTS.admin);
      await page.goto('/admin/users');
      page.once('dialog', (d) => void d.accept());
      await page.getByRole('row').filter({ hasText: email }).getByRole('button', { name: 'Khóa', exact: true }).click();
      await expect(page.getByRole('row').filter({ hasText: email }).getByText('Đã khóa')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('admin tai anh bia va chen anh vao bai; anh hien trong xem truoc, khong vi pham CSP', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/content security policy|refused to (load|connect|frame|execute)/i.test(m.text())) violations.push(m.text());
    });
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/articles/new');

    await page.getByLabel('Tải ảnh bìa lên').setInputFiles({ name: 'bia.png', mimeType: 'image/png', buffer: PNG_1X1 });
    const cover = page.getByLabel('Ảnh bìa (URL https hoặc tải lên)');
    await expect(cover).toHaveValue(/^\/api\/uploads\/[a-f0-9]{32}\.png$/);
    uploaded.push(await cover.inputValue());
    const preview = page.getByAltText('Ảnh bìa đã chọn');
    await expect(preview).toBeVisible();
    expect(await preview.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(1);

    page.once('dialog', (d) => void d.accept('Anh thu nghiem'));
    await page.getByLabel('Chèn ảnh').setInputFiles({ name: 'noidung.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await expect(page.locator('#content')).toHaveValue(/<img src="\/api\/uploads\/[a-f0-9]{32}\.png" alt="Anh thu nghiem">/);
    uploaded.push(...((await page.locator('#content').inputValue()).match(/\/api\/uploads\/[a-f0-9]{32}\.png/g) ?? []));
    const frameImg = page.frameLocator('iframe[title="Xem trước bài viết"]').locator('img');
    await expect(frameImg).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Tep gia anh bi tu choi o phia may chu
    const fake = await page.request.post('/api/admin/uploads', { data: '<script>alert(1)</script>', headers: { ...ORIGIN, 'content-type': 'image/png' } });
    expect(fake.status()).toBe(415);
    expect(violations).toEqual([]);
  });
});
