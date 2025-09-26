import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Allow overriding base path for GitHub Pages deployments
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
});
