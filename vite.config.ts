import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: './', // relative paths so the built site works from any folder/subpath
  plugins: [nodePolyfills()],
});
