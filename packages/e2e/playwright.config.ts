import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Mat khau seed doc tu .env cua repo; khong ghi ra log.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  /* khong co .env: bien moi truong phai duoc dat san */
}

const PORT = 3000;
const PS = 'powershell -NoProfile -ExecutionPolicy Bypass -Command';
// Duong dan toi scripts/env.ps1 tinh tu vi tri file nay, khong hardcode theo may.
const ENV_PS1 = fileURLToPath(new URL('../../scripts/env.ps1', import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }, testMatch: /(responsive|shots|wave1)\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } }, testMatch: /(responsive|shots|wave1)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `${PS} ". '${ENV_PS1}'; pnpm --filter '@wtl/api' start:prod"`,
      url: 'http://127.0.0.1:4000/api/health',
      // Bo e2e dang nhap hon 20 lan/phut tu mot IP nen can nang gioi han (mac dinh production van la 20).
      env: { AUTH_RATE_LIMIT_PER_MIN: '300', RATE_LIMIT_PER_MIN: '2000' },
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `${PS} ". '${ENV_PS1}'; pnpm --filter '@wtl/web' start"`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
