import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// Build in the same Workers runtime as the local preview, then publish only
// vinext's static export. Vercel does not run the generated Worker bundle.
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext(), cloudflare({
    viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    config: { main: 'vinext/server/fetch-handler', compatibility_flags: ['nodejs_compat'] },
  })],
});
