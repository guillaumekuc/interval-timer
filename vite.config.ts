import { defineConfig } from 'vite';

/**
 * GitHub Pages serves project sites at https://<user>.github.io/<repo>/ — assets must use that prefix.
 * Workflow sets BASE_PATH=/interval-timer for production builds. Local dev defaults to "/".
 */
function baseUrl(): string {
  const p = process.env.BASE_PATH?.trim();
  if (!p || p === '/') return '/';
  return p.endsWith('/') ? p : `${p}/`;
}

export default defineConfig({
  base: baseUrl(),
});
