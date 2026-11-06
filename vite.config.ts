import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // dépendances préoptimisées dès le démarrage : évite qu'une réoptimisation en cours de partie
  // ne charge deux copies de Rapier (écran noir « raweventqueue_new »)
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing', '@react-three/rapier', '@dimforge/rapier3d-compat', 'howler', 'zustand', 'three/examples/jsm/utils/BufferGeometryUtils.js', 'three/examples/jsm/geometries/RoundedBoxGeometry.js'],
  },
  server: {
    host: true,
    port: 5180,
    // l'API PHP tourne à côté (php -S 127.0.0.1:8787 -t public)
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
          // The physics engine ships its WebAssembly inside its JavaScript: its own file downloads in
          // parallel and stays cached across game updates.
          // Keep the React wrapper with the application to avoid a circular dependency with r3f.
          physics: ['@dimforge/rapier3d-compat'],
          audio: ['howler'],
        },
      },
    },
  },
})
