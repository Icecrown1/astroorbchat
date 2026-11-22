import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [] } },
  server: {
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
