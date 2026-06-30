import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const SYSTEM_CHROMIUM_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((candidate): candidate is string => Boolean(candidate));

const systemChromiumExecutablePath = SYSTEM_CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));
const videoMode = process.env.PLAYWRIGHT_ENABLE_VIDEO === '1' ? 'retain-on-failure' : 'off';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  grepInvert: process.env.RUN_AI_E2E === '1' ? undefined : /@ai/,
  reporter: [
    ['html', { outputFolder: '../test-results/e2e-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5284',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: videoMode,
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        channel: undefined,
        ...(systemChromiumExecutablePath
          ? { launchOptions: { executablePath: systemChromiumExecutablePath } }
          : {}),
      },
    },
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        channel: undefined,
        ...(systemChromiumExecutablePath
          ? { launchOptions: { executablePath: systemChromiumExecutablePath } }
          : { channel: 'chrome' as const }),
      },
    },
  ],
});
