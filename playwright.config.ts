import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

let hasLoadedTestEnv = false;

const testEnvPath = resolve(process.cwd(), '.env.test');

if (existsSync(testEnvPath)) {
  process.loadEnvFile(testEnvPath);
  hasLoadedTestEnv = true;
}

if (!hasLoadedTestEnv) {
  throw new Error('Playwright requires a dedicated .env.test file.');
}

const PORT = Number(process.env.PORT ?? '3000');
const baseURL = `http://127.0.0.1:${PORT}`;
const webServerCommand = process.env.CI
  ? `bun run build && bun run start:e2e -- --port ${PORT}`
  : `bun run dev:e2e -- --port ${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.ts'],
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  workers: process.env.CI ? '50%' : undefined,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
