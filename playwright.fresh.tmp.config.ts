import base from './playwright.config'
export default { ...base, use: { ...base.use, baseURL: 'http://localhost:5199' }, webServer: [
  { command: 'node scripts/local.mjs --api-only', port: 8787, reuseExistingServer: true },
  { command: 'npx vite --port 5199 --strictPort', port: 5199, reuseExistingServer: false },
] }
