import { readdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, request, test, type Page } from '@playwright/test';
import { ACCOUNTS, answerFirstOptions, login, logout, seedPassword } from './helpers';

test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const email = `wave1.${stamp}@example.test`;
const pass1 = () => `${seedPassword()}-w1`;
const pass2 = () => `${seedPassword()}-w2`;
const OUTBOX = fileURLToPath(new URL('../../../data/outbox', import.meta.url));
const ORIGIN = 'http://localhost:3000';
let caseId = '';

async function outboxFilesFor(to: string): Promise<{ file: string; text: string }[]> {
  let names: string[] = [];
  try {
    names = await readdir(OUTBOX);
  } catch {
    return [];
  }
  const out: { file: string; text: string }[] = [];
  for (const n of names.filter((x) => x.endsWith('.json'))) {
    const path = `${OUTBOX}/${n}`;
    const j = JSON.parse(await readFile(path, 'utf8')) as { to: string; text: string };
    if (j.to === to) out.push({ file: path, text: j.text });
  }
  return out;
}

// Don dep du lieu e2e tren DB dev: dong ca, vo hieu hoa tai khoan, xoa thu trong outbox.
test.afterAll(async ({ baseURL }) => {
  for (const f of await outboxFilesFor(email)) await rm(f.file, { force: true });
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
  try {
    const res = await api.post('/api/auth/login', { data: { email: ACCOUNTS.admin, password: seedPassword() } });
    if (!res.ok()) return;
    if (caseId) await api.post(`/api/cases/${caseId}/transition`, { data: { to: 'closed' } });
    const users = (await (await api.get('/api/admin/users')).json()) as { users?: { id: string; email: string }[] };
    const me = users.users?.find((u) => u.email === email);
    if (me) await api.patch(`/api/admin/users/${me.id}/status`, { data: { status: 'disabled' } });
  } finally {
    await api.dispose();
  }
});

const answer = (page: Page, i: number, choice: number) => page.locator('fieldset').nth(i).locator('input').nth(choice).check();

test('tu danh gia PHQ-9 cho khach vang lai: tinh diem, cau 9 khac 0 thi hien hotline', async ({ page }) => {
  await page.goto('/tu-danh-gia');
  await expect(page.getByText('không phải chẩn đoán').first()).toBeVisible();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(page.getByText('Vui lòng trả lời tất cả các câu')).toBeVisible(); // chua tra loi het

  for (let i = 0; i < 9; i++) await answer(page, i, 0);
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(page.getByTestId('assessment-score')).toContainText('0');
  await expect(page.getByText('Nếu bạn có ý nghĩ làm hại bản thân')).toBeHidden();
  await expect(page.getByText('Đăng nhập').first()).toBeVisible(); // goi y dang nhap de luu

  await answer(page, 8, 1); // doi cau 9 -> ket qua cu bi go
  await expect(page.getByTestId('assessment-score')).toBeHidden();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(page.getByTestId('assessment-score')).toContainText('1');
  await expect(page.getByText('Nếu bạn có ý nghĩ làm hại bản thân')).toBeVisible();
  await expect(page.getByRole('link', { name: '115' }).first()).toBeVisible();
});

test('tim chuyen gia: bo loc trong URL va sap xep', async ({ page }) => {
  await page.goto('/experts');
  await page.getByLabel('Hình thức').selectOption('online');
  await page.getByLabel('Sắp xếp').selectOption('rating');
  await page.getByRole('button', { name: 'Tìm chuyên gia' }).click();
  await expect(page).toHaveURL(/mode=online/);
  await expect(page).toHaveURL(/sort=rating/);
  await expect(page.getByRole('link', { name: 'Xóa bộ lọc' })).toBeVisible();
  await page.goto('/experts?q=zzzkhongco');
  await expect(page.getByText('Chưa có chuyên gia phù hợp')).toBeVisible();
});

test('quen mat khau: gui lien ket qua outbox, dat mat khau moi, mat khau cu het tac dung', async ({ page, baseURL }) => {
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Khach Wave1');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(pass1());
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await expect(page).not.toHaveURL(/\/register/);
  await logout(page);

  // Email la an: email khong ton tai va email co that deu nhan cung mot thong bao
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(`khong-ton-tai.${stamp}@example.test`);
  await page.getByRole('button', { name: 'Gửi liên kết' }).click();
  await expect(page.getByText('Nếu email này đã đăng ký')).toBeVisible();
  expect(await outboxFilesFor(`khong-ton-tai.${stamp}@example.test`)).toHaveLength(0);

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Gửi liên kết' }).click();
  await expect(page.getByText('Nếu email này đã đăng ký')).toBeVisible();

  await expect.poll(async () => (await outboxFilesFor(email)).length, { timeout: 10_000 }).toBeGreaterThan(0);
  const mail = (await outboxFilesFor(email))[0]!;
  const token = /reset-password#token=([A-Za-z0-9_-]+)/.exec(mail.text)?.[1];
  expect(token, 'thu phai co lien ket dat lai').toBeTruthy();

  await page.goto(`/reset-password#token=${token}`);
  await expect(page).toHaveURL(/\/reset-password$/); // token da bi go khoi thanh dia chi
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(pass2());
  await page.getByLabel('Nhập lại mật khẩu mới').fill(pass2());
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();
  await expect(page.getByText('Đã đặt mật khẩu mới')).toBeVisible();

  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: ORIGIN } });
  expect((await api.post('/api/auth/login', { data: { email, password: pass1() } })).status()).toBe(401);
  expect((await api.post('/api/auth/login', { data: { email, password: pass2() } })).ok()).toBeTruthy();

  // Dung lai lien ket cu (mo nhu mot lan truy cap moi): bi tu choi
  await page.goto('about:blank');
  await page.goto(`/reset-password#token=${token}`);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(`${pass2()}x`);
  await page.getByLabel('Nhập lại mật khẩu mới').fill(`${pass2()}x`);
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();
  await expect(page.getByText('Đã đặt mật khẩu mới')).toBeHidden();
  await api.dispose();
});

test('khach gui ho so, admin duyet va phan cong', async ({ page }) => {
  await login(page, email, pass2());
  await page.goto('/screening');
  await answerFirstOptions(page);
  await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
  await expect(page.getByRole('button', { name: 'Gửi hồ sơ' })).toBeHidden();
  caseId = ((await (await page.request.get('/api/cases/mine')).json()) as { cases: { id: string }[] }).cases[0]!.id;
  await logout(page);

  await login(page, ACCOUNTS.admin);
  const h = { origin: ORIGIN };
  const users = (await (await page.request.get('/api/admin/users')).json()) as { users: { id: string; email: string }[] };
  const expertId = users.users.find((u) => u.email === ACCOUNTS.expert)!.id;
  expect((await page.request.post(`/api/cases/${caseId}/transition`, { data: { to: 'approved' }, headers: h })).ok()).toBeTruthy();
  expect((await page.request.post(`/api/cases/${caseId}/transition`, { data: { to: 'assigned', expertId }, headers: h })).ok()).toBeTruthy();
});

test('khach ghi nhat ky tam trang va luu ket qua tu danh gia, co chia se', async ({ page }) => {
  await login(page, email, pass2());
  await page.goto('/me/mood');
  await page.getByRole('radio', { name: /^Tốt/ }).click();
  await page.getByLabel(/Ghi chú/).fill('Hom nay on hon');
  await page.getByLabel(/Chia sẻ mục này/).check();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Hom nay on hon')).toBeVisible();
  await expect(page.getByText('Đang chia sẻ với chuyên gia').first()).toBeVisible();

  // Mot muc khac giu rieng tu
  await page.getByRole('radio', { name: /^Tệ/ }).click();
  await page.getByLabel(/Ghi chú/).fill('Muc rieng tu cua toi');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Muc rieng tu cua toi')).toBeVisible();

  await page.goto('/tu-danh-gia');
  await page.getByRole('tab', { name: /GAD-7/ }).click();
  for (let i = 0; i < 7; i++) await answer(page, i, 1);
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(page.getByTestId('assessment-score')).toContainText('7');
  await page.getByLabel(/Chia sẻ kết quả này/).check();
  await page.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText('Đã lưu.')).toBeVisible();
});

test('chuyen gia giao bai tap, thay muc khach da chia se (khong thay muc rieng tu), ghi chu rieng; khach nop bai', async ({ page, browser }) => {
  await login(page, ACCOUNTS.expert);
  await page.goto(`/expert/cases/${caseId}`);

  await page.getByRole('tab', { name: 'Bài tập' }).click();
  await page.getByLabel('Tiêu đề').fill('Viet nhat ky biet on');
  await page.getByLabel('Hướng dẫn').fill('Moi toi ghi 3 dieu biet on');
  await page.getByRole('button', { name: 'Giao bài' }).click();
  await expect(page.getByText('Viet nhat ky biet on')).toBeVisible();

  await page.getByRole('tab', { name: 'Theo dõi' }).click();
  await expect(page.getByText('Hom nay on hon')).toBeVisible();
  await expect(page.getByText('Muc rieng tu cua toi')).toHaveCount(0);
  await expect(page.getByText(/GAD-7/).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Ghi chú' }).click();
  await page.getByLabel('Ghi chú mới').fill('Ghi chu lam sang rieng tu cua chuyen gia');
  await page.getByRole('button', { name: 'Lưu ghi chú' }).click();
  await expect(page.getByText('Ghi chu lam sang rieng tu cua chuyen gia')).toBeVisible();

  // Khach thay bai tap, nop bai; khach khong doc duoc ghi chu cua chuyen gia
  const ctx = await browser.newContext({ baseURL: ORIGIN });
  const cp = await ctx.newPage();
  await login(cp, email, pass2());
  await cp.goto(`/me/cases/${caseId}`);
  await cp.getByRole('tab', { name: 'Bài tập' }).click();
  await expect(cp.getByText('Moi toi ghi 3 dieu biet on')).toBeVisible();
  await cp.getByLabel('Bài làm của bạn').fill('1. Suc khoe 2. Gia dinh 3. Cong viec');
  await cp.getByRole('button', { name: 'Nộp bài' }).click();
  await expect(cp.getByText('Đã nộp').first()).toBeVisible();
  expect((await cp.request.get(`/api/cases/${caseId}/notes`)).status()).toBe(403);
  expect((await cp.request.get(`/api/cases/${caseId}/client-tracking`)).status()).toBe(403);

  // Chuong thong bao: chuyen gia da nhan thong bao ve ca duoc phan; khach thay thong bao ve ca
  await cp.goto('/me');
  await cp.getByRole('button', { name: /^Thông báo/ }).click();
  await expect(cp.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();
  await expect(cp.getByText('Chưa có thông báo nào.')).toBeHidden();
  await ctx.close();

  await page.goto('/expert');
  await page.getByRole('button', { name: /^Thông báo/ }).click();
  await expect(page.getByRole('dialog', { name: 'Thông báo' }).getByRole('listitem').first()).toBeVisible();

  // Quan tri khong doc duoc noi dung rieng tu cua ca
  await logout(page);
  await login(page, ACCOUNTS.admin);
  expect((await page.request.get(`/api/cases/${caseId}/notes`)).status()).toBe(404);
  expect((await page.request.get(`/api/cases/${caseId}/client-tracking`)).status()).toBe(403);
  expect((await page.request.get(`/api/cases/${caseId}/homework`)).status()).toBe(403);
});

test('admin: trang duyet danh gia hoat dong', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await page.goto('/admin/reviews');
  await expect(page.getByRole('heading', { name: 'Duyệt đánh giá' })).toBeVisible();
  await page.getByRole('tab', { name: 'Đã đăng' }).click();
  await expect(page.getByRole('tab', { name: 'Đã đăng' })).toHaveAttribute('aria-selected', 'true');
});
