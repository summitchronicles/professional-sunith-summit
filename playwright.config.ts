import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run preview -- --port 4321',
    port: 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
};

export default config;

