// 결 로고 SVG → PNG 렌더러 (sharp). 한글 폰트 의존성 없는 순수 벡터라 어디서든 동일하게 출력됨.
// 사용: node scripts/build-logo.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'brand/gyeol-logo.svg'));

// [출력경로, 크기]
const targets = [
  ['brand/gyeol-logo-1024.png', 1024],
  ['brand/gyeol-logo-512.png', 512],
  ['brand/gyeol-logo-100.png', 100],   // 토스 개발자센터 권장 100×100
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
];

for (const [out, size] of targets) {
  const dest = resolve(root, out);
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);
  console.log(`✓ ${out}  (${size}×${size})`);
}
console.log('done');
