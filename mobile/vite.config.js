import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  if (mode === 'play-internal' && loadEnv(mode, process.cwd(), 'VITE_').VITE_ASTROORBI_API_URL !== 'https://astro-orbi-android-sandbox.replit.app') {
    throw new Error('Set VITE_ASTROORBI_API_URL to the isolated Android sandbox for Play internal testing.');
  }
  return {
  base: './',
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [] } },
  server: {
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  };
});
