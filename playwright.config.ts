import { defineConfig, devices } from '@playwright/test'

const port = 5173
const base = `http://127.0.0.1:${port}`
const api = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000'

export default defineConfig({
  testDir: './tests/e2e',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  use: {
    baseURL: base,
  },
  webServer: {
    command: `npm run dev --workspace @nvara/web -- --host 127.0.0.1 --port ${port}`,
    url: base,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://nvara:nvara_local_dev_only@localhost:55432/nvara',
      VITE_API_ORIGIN: api,
    },
  },
})
