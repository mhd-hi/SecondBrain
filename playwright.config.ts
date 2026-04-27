import { defineConfig, devices } from '@playwright/test';

process.loadEnvFile();

const baseURL = `http://127.0.0.1:3000`;
const PORT = process.env.PORT || 3000;

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
    command: process.env.CI ? `bun run start -- -p ${PORT}` : 'bun run dev',
    url: baseURL,
    env: {
      ...process.env,
      PORT: String(3000),
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
