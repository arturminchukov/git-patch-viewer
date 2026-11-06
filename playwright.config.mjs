import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '*.pw.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    viewport: { width: 1280, height: 800 },
    trace: process.env.GPV_STRESS_GIANT_LINE_CHARS ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
