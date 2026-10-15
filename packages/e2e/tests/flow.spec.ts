import { expect, request, test } from '@playwright/test';
import { ACCOUNTS, answerFirstOptions, login, logout, seedPassword } from './helpers';

test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const email = `e2e.${stamp}@example.test`;
const title = `Bai viet e2e ${stamp}`;
let caseId = '';
let articleId = '';

// Cac test chay tren DB that cua moi truong dev: don dep de khong de rac (bai viet cong khai, ca, tai khoan).
test.afterAll(async ({ baseURL }) => {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
  try {
    const res = await api.post('/api/auth/login', { data: { email: ACCOUNTS.admin, password: seedPassword() } });
    if (!res.ok()) return;
    if (articleId) await api.delete(`/api/admin/articles/${articleId}`);
    if (caseId) {
      const appts = (await (await api.get(`/api/cases/${caseId}/appointments`)).json()) as { appointments?: { id: string; status: string }[] };
      for (const a of appts.appointments ?? []) {
        if (a.status === 'requested' || a.status === 'confirmed') await api.post(`/api/appointments/${a.id}/cancel`, { data: {} });
      }
      await api.post(`/api/cases/${caseId}/transition`, { data: { to: 'closed' } });
    }
    const users = (await (await api.get('/api/admin/users')).json()) as { users?: { id: string; email: string }[] };
    const me = users.users?.find((u) => u.email === email);
    if (me) await api.patch(`/api/admin/users/${me.id}/status`, { data: { status: 'disabled' } });
  } finally {
    await api.dispose();
  }
});

test('khach dang ky va gui ho so sang loc', async ({ page }) => {
  await page.goto('/register?next=/screening');
  await page.getByLabel('Họ và tên').fill('Khach E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(`${seedPassword()}-e2e`);
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await expect(page).toHaveURL(/\/screening/);
  await answerFirstOptions(page);
  await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
  await expect(page.getByRole('button', { name: 'Gửi hồ sơ' })).toBeHidden();
  const res = await page.request.get('/api/cases/mine');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { cases: { id: string }[] };
  caseId = body.cases[0]!.id;
  expect(caseId).toBeTruthy();
});

test('admin duyet va phan cong chuyen gia', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await login(page, ACCOUNTS.admin);
  await page.goto(`/admin/cases/${caseId}`);
  await page.getByRole('button', { name: 'Duyệt hồ sơ' }).click();
  const assign = page.getByRole('button', { name: "Phân cho chuyên gia" }).first();
  await expect(assign).toBeVisible();
  await assign.click();
  await expect(page.getByText('Đã phân chuyên gia').first()).toBeVisible();
});

test('khach dat lich, chuyen gia xac nhan, hai ben nhan tin', async ({ page, browser }) => {
  await login(page, email, `${seedPassword()}-e2e`);
  await page.goto(`/me/cases/${caseId}`);
  await page.getByRole('tab', { name: 'Lịch hẹn' }).click();
  await page.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).first().click();
  await page.getByRole('button', { name: 'Xác nhận đặt lịch' }).click();
  await expect(page.getByText("Chờ chuyên gia xác nhận").first()).toBeVisible();

  const ctx = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const ep = await ctx.newPage();
  await login(ep, ACCOUNTS.expert);
  await ep.goto('/expert/appointments');
  await ep.getByRole('button', { name: 'Xác nhận' }).first().click();
  await expect(ep.getByText('Đã xác nhận').first()).toBeVisible();

  // Khach mo san khung chat; tin cua chuyen gia phai den ngay qua socket (khong reload, nhanh hon chu ky hoi 8s)
  await page.goto(`/me/cases/${caseId}`);
  await page.getByRole('tab', { name: 'Trò chuyện' }).click();
  await expect(page.locator('#chat-input')).toBeVisible();
  await page.waitForTimeout(1500); // cho socket kip ket noi truoc khi chuyen gia gui
  await ep.goto(`/expert/cases/${caseId}`);
  await ep.getByRole('tab', { name: 'Trò chuyện' }).click();
  await ep.locator('#chat-input').fill('Xin chao tu chuyen gia');
  await ep.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByText('Xin chao tu chuyen gia')).toBeVisible({ timeout: 4_000 });
  await ctx.close();
});

test('admin dang bai, khach vang lai chi doc duoc khi da xuat ban', async ({ page, browser }) => {
  await login(page, ACCOUNTS.admin);
  await page.goto('/admin/articles/new');
  await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
  await page.getByLabel(/Tóm tắt/).fill('Tom tat bai e2e');
  await page.locator('#content').fill('<p>Noi dung an toan</p><script>window.__xss=1</script>');
  await page.getByRole('button', { name: 'Tạo bài viết' }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}/);
  articleId = page.url().split('/').pop()!;
  const slug = await page.getByLabel(/Đường dẫn/).inputValue();

  const anon = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const ap = await anon.newPage();
  expect((await ap.goto(`/articles/${slug}`))?.status()).toBe(404);

  await page.getByRole('button', { name: 'Xuất bản' }).click();
  await expect(page.getByText('Đã xuất bản').first()).toBeVisible();
  const r = await ap.goto(`/articles/${slug}`);
  expect(r?.status()).toBe(200);
  await expect(ap.getByText('Noi dung an toan')).toBeVisible();
  expect(await ap.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await anon.close();
});

test('phan quyen: khach bi chan khoi API admin/chuyen gia, an danh bi chan khoi API rieng tu', async ({ page }) => {
  await login(page, email, `${seedPassword()}-e2e`);
  expect((await page.request.get('/api/admin/users')).status()).toBe(403);
  expect((await page.request.get('/api/expert/cases')).status()).toBe(403);
  expect((await page.request.get(`/api/admin/cases?status=pending`)).status()).toBe(403);
  await logout(page);
  expect((await page.request.get('/api/cases/mine')).status()).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=/);
});
