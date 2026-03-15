import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SPRITE_DIRS = ['gen5', 'gen5-back', 'gen5-shiny', 'gen5-back-shiny'] as const;
const BASE_URL = 'https://play.pokemonshowdown.com/sprites';
const OUTPUT_DIR = join(import.meta.dirname, '..', 'public', 'sprites');

async function fetchSpriteList(dir: string): Promise<string[]> {
  const url = `${BASE_URL}/${dir}/`;
  console.log(`Fetching sprite list from ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  // Parse <a href="name.png"> links from directory listing
  const matches = html.matchAll(/href="([^"]+\.png)"/gi);
  return [...matches].map(m => m[1]);
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buffer);
    return true;
  } catch {
    return false;
  }
}

async function downloadDir(dir: string) {
  const outDir = join(OUTPUT_DIR, dir);
  mkdirSync(outDir, { recursive: true });

  const files = await fetchSpriteList(dir);
  console.log(`Found ${files.length} sprites in ${dir}`);

  let downloaded = 0;
  let skipped = 0;
  const concurrency = 20;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    await Promise.all(batch.map(async (file) => {
      const dest = join(outDir, file);
      if (existsSync(dest)) {
        skipped++;
        return;
      }
      const url = `${BASE_URL}/${dir}/${file}`;
      const ok = await downloadFile(url, dest);
      if (ok) {
        downloaded++;
      } else {
        console.warn(`  Failed: ${file}`);
      }
    }));
    const total = downloaded + skipped;
    if (total % 100 < concurrency) {
      console.log(`  ${dir}: ${total}/${files.length} (${downloaded} new, ${skipped} cached)`);
    }
  }
  console.log(`  ${dir} done: ${downloaded} downloaded, ${skipped} skipped`);
}

async function main() {
  console.log('Downloading Pokemon sprites from Showdown...\n');
  for (const dir of SPRITE_DIRS) {
    await downloadDir(dir);
    console.log();
  }
  console.log('All sprites downloaded!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
