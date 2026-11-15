// Copies data/processed into web/public/data with a SHA-256 index. Runs before dev and build.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const processed = join(web, '../data/processed');
const out = join(web, 'public/data');
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });

function copy(fromDir, pattern, toSub) {
  const files = readdirSync(fromDir).filter(f => pattern.test(f)).sort(natural);
  mkdirSync(join(out, toSub), { recursive: true });
  return files.map(name => {
    const bytes = readFileSync(join(fromDir, name));
    const purpose = JSON.parse(bytes.toString('utf8')).purpose;
    if (purpose !== 'research') throw new Error(`${name}: purpose "${purpose}" is not research; refusing to publish`);
    writeFileSync(join(out, toSub, name), bytes);
    return { file: toSub ? `${toSub}/${name}` : name, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const datasets = copy(processed, /^site-\d+_window-[a-z]+\.json$/, '');
const terrain = copy(join(processed, 'terrain'), /^site-\d+\.json$/, 'terrain');
if (datasets.length === 0) throw new Error(`no site/window JSON in ${processed}`);
const index = { schemaVersion: '1.0', generatedUtc: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), datasets, terrain };
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
console.log(`sync-data: ${datasets.length} site/window files, ${terrain.length} terrain patches -> public/data`);
