import { defineConfig, mergeConfig, type Plugin } from 'vite'
import base from '../vite.config'

const offlineApi: Plugin = {
  name: 'isolated-guest-api',
  configureServer(server) {
    server.middlewares.use('/api', (_req, res) => {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end('{}')
    })
  },
}
export default mergeConfig(base, defineConfig({
  plugins: [offlineApi],
  server: { host: '127.0.0.1', port: 5184, strictPort: true },
}))
