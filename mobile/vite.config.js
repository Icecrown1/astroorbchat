import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  if (mode === 'android-sandbox') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const origin = new URL(env.VITE_ASTROORBI_API_URL);
    if (origin.protocol !== 'https:' || origin.origin + '/' !== origin.href ||
        ['astroorbiapp.com', 'astro-orb-chat.replit.app', 'astroorbi.com'].includes(origin.hostname)) {
      throw new Error('Use the separate Android sandbox HTTPS origin in VITE_ASTROORBI_API_URL.');
    }
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
