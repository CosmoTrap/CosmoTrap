import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Guest-only integration tests: never start PHP or modify real accounts/scores.
export default defineConfig({
  ...base,
  testMatch: ['lunar-*.spec.ts'],
  globalTeardown: undefined,
  outputDir: 'test-results/lunar',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5184' },
  webServer: {
    command: 'npm run dev -- --config tests/vite.offline.config.ts',
    url: 'http://127.0.0.1:5184',
    reuseExistingServer: false,
  },
})
