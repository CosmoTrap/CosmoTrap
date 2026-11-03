/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

// Test de bout en bout : API PHP (port 8787) + jeu Vite (port 5180).
export default defineConfig({
  testDir: './tests',
  timeout: 8 * 60 * 1000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180',
    viewport: { width: 1280, height: 720 },
    launchOptions: { ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      args: process.env.PLAYWRIGHT_SOFTWARE === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] },
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: [
    { command: 'node scripts/local.mjs --api-only', port: 8787, reuseExistingServer: true },
    { command: 'npm run dev', port: 5180, reuseExistingServer: true },
  ],
})
