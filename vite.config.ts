import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA || new Date().toISOString(),
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['buildCRM.png'],
      manifest: {
        name: 'BuildCRM',
        short_name: 'BuildCRM',
        display: 'standalone',
        start_url: '/',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'buildCRM.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'buildCRM.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
