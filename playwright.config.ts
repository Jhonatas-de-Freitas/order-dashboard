import { defineConfig, devices } from '@playwright/test';

// Not the default preview port, so a dev server left running does not get in the way.
const PORT = 47822;
const PAGES_PORT = 47823;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  // An order takes up to six seconds to reach its final state in the demo.
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'app',
      testDir: './tests/e2e',
      use: { baseURL: `http://localhost:${PORT}` },
    },
    {
      // The build that goes to GitHub Pages, behind a server that behaves like it.
      name: 'github-pages',
      testDir: './tests/pages',
      use: { baseURL: `http://localhost:${PAGES_PORT}/order-dashboard/` },
    },
  ],
  webServer: [
    {
      command: `npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
    },
    {
      command: `node tests/pages/github-pages.ts ${PAGES_PORT}`,
      url: `http://localhost:${PAGES_PORT}/order-dashboard/`,
      reuseExistingServer: false,
    },
  ],
});
