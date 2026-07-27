import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Inline PostCSS config so Vite does not walk parent directories looking for one.
  css: {
    postcss: {
      plugins: [],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve workspace packages from source for correct ESM bundling.
      '@fleetnexus/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@fleetnexus/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
