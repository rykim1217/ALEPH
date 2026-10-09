import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
// Explicit allowlist: development files must never enter the public output.
const files = ['index.html', 'src/styles.css', 'src/app.js', 'src/calendar.js', 'src/data.js'];

if (output !== path.join(root, 'dist')) throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(output, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
console.log(`PACE: built ${files.length} static files in dist/`);
