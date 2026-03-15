import process from 'node:process'
import { defineConfig } from '@playwright/test'

const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '42173'
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || '42187'
const apiOrigin = process.env.PLAYWRIGHT_API_ORIGIN || `http://localhost:${backendPort}`
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${frontendPort}`
const allowedOrigins = [baseUrl, `http://127.0.0.1:${frontendPort}`].join(',')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 1024 },
  },
  webServer: {
    command: 'npm run dev:local',
    url: baseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: backendPort,
      FRONTEND_PORT: frontendPort,
      VITE_API_BASE_URL: apiOrigin,
      CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || allowedOrigins,
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
      LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT || '.clipflow-storage',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
})
