import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:8082',
          changeOrigin: true,
          configure(proxy) {
            proxy.on('error', () => {
              // Spring Boot is optional until phase 2
            })
          },
        },
      },
    },
  }
})
