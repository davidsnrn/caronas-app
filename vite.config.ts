import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use VITE_BASE_PATH env var if set (GH Pages), otherwise default to root (Vercel/Local)
  base: process.env.VITE_BASE_PATH || '/',
})