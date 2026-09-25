// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Flugmodus - Frontend',
        short_name: 'Flugmodus',
        theme_color: '#ffffff'
      },
      workbox: {
        globPatterns: ['**/*.{ts,js,css,html,ico,png,svg}']
      }
    })
  ]
})