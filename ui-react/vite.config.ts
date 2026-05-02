import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { BACKEND_DEV_ORIGIN, UI_DEV_PORT } from './src/lib/ports'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: UI_DEV_PORT,
    proxy: {
      '/ocrux': {
        target: process.env.OCRUX_ORIGIN || BACKEND_DEV_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
