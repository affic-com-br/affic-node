import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsup';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'node20',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Baked in at build time so the runtime never has to read package.json,
  // which is unreliable once the code is bundled or re-bundled by consumers.
  define: { __SDK_VERSION__: JSON.stringify(packageJson.version) },
});
