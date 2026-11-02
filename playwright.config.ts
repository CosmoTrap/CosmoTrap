import { defineConfig, devices } from '@playwright/test'

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
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: [
    { command: 'php -S 127.0.0.1:8787 -t public', port: 8787, reuseExistingServer: true },
    { command: 'npm run dev', port: 5180, reuseExistingServer: true },
  ],
})
