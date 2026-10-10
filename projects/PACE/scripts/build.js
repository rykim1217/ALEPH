import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
// Explicit allowlist: development files must never enter the public output.
const files = ['index.html', 'src/styles.css', 'src/app.js', 'src/calendar.js', 'src/data.js', 'src/certifications.js', 'src/color-palette.js', 'src/availability.js', 'src/study.js', 'src/study-manager.js', 'src/backup.js', 'src/backup-import.js', 'src/study-item-edit.js', 'src/registered-manager.js', 'src/category-order.js', 'src/study-planning.js', 'src/distribution-settings.js', 'src/distribution-preview.js', 'src/study-display.js', 'src/study-schedule.js'];

if (output !== path.join(root, 'dist')) throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(output, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
console.log(`PACE: built ${files.length} static files in dist/`);
