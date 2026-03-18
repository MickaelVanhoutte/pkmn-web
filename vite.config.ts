import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version',
    writeBundle({ dir }) {
      if (!dir) return;
      const swPath = resolve(dir, 'sw.js');
      try {
        const content = readFileSync(swPath, 'utf-8');
        writeFileSync(swPath, content.replaceAll('__BUILD_TIMESTAMP__', Date.now().toString()));
      } catch {
        // sw.js not in output, skip
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: '/pkmn-web/',
  plugins: [swVersionPlugin()],
});
