import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const posterDir = join(root, 'poster');

const files = [
  'gyeol_conclusion_board.svg',
  'gyeol_3stage_expansion_model.svg',
  'gyeol_field_operation_results.svg',
];

const DENSITY = 216; // 3x for crisp poster placement

for (const f of files) {
  const inPath = join(posterDir, f);
  const outPath = join(posterDir, basename(f, '.svg') + '.png');
  const svg = readFileSync(inPath);
  const meta = await sharp(svg).metadata();
  await sharp(svg, { density: DENSITY })
    .png()
    .toFile(outPath);
  const out = await sharp(outPath).metadata();
  console.log(`${f} -> ${basename(outPath)}  (${out.width}x${out.height})`);
}
console.log('DONE');
