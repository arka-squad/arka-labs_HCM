import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hcmApiBaseUrl = env.VITE_HCM_API_BASE_URL || 'http://localhost:9096'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: hcmApiBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
