/**
 * SVG → 트레이 PNG + Windows ICO + Mac ICNS 자동 생성.
 *
 * 사용: `node scripts/generate-icons.mjs`
 * package.json 의 prebuild 에서 자동 호출됨.
 *
 * 의존성: sharp (devDependencies). png-to-ico (선택 — Mac ICNS 는 png2icons 필요).
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SVG = path.join(ROOT, "assets", "icon.svg");
const OUT = path.join(ROOT, "assets");

const SIZES = {
  "tray-icon.png": 32,        // 트레이 메인
  "tray-icon@2x.png": 64,     // 고해상도
  "icon-16.png": 16,
  "icon-32.png": 32,
  "icon-48.png": 48,
  "icon-64.png": 64,
  "icon-128.png": 128,
  "icon-256.png": 256,
  "icon-512.png": 512,
  "icon.png": 256,            // 일반 용도
};

async function main() {
  const svg = await fs.readFile(SVG);
  await Promise.all(
    Object.entries(SIZES).map(async ([name, size]) => {
      const target = path.join(OUT, name);
      await sharp(svg).resize(size, size).png().toFile(target);
      console.log(`  ✓ ${name} (${size}x${size})`);
    })
  );

  // Windows ICO — 여러 크기 합본
  try {
    const pngToIco = (await import("png-to-ico")).default;
    const icoBuf = await pngToIco([
      path.join(OUT, "icon-16.png"),
      path.join(OUT, "icon-32.png"),
      path.join(OUT, "icon-48.png"),
      path.join(OUT, "icon-256.png"),
    ]);
    await fs.writeFile(path.join(OUT, "icon.ico"), icoBuf);
    console.log("  ✓ icon.ico (multi-size)");
  } catch (e) {
    console.warn("  ⚠️ icon.ico 생성 실패 (png-to-ico 미설치 또는 권한 문제). NSIS 빌드는 PNG 로도 가능.");
    console.warn("     상세:", e?.message ?? e);
  }

  // Mac ICNS — png2icons 가 안전. 실패해도 무시.
  try {
    const png2icons = (await import("png2icons")).default;
    const png512 = await fs.readFile(path.join(OUT, "icon-512.png"));
    const icnsBuf = png2icons.createICNS(png512, png2icons.BILINEAR, 0);
    if (icnsBuf) {
      await fs.writeFile(path.join(OUT, "icon.icns"), icnsBuf);
      console.log("  ✓ icon.icns");
    }
  } catch {
    console.warn("  ⚠️ icon.icns 생성 스킵 (Mac 빌드 안 할 거면 무시 OK).");
  }

  console.log("아이콘 생성 완료.");
}

main().catch((e) => {
  console.error("[generate-icons] FAILED", e);
  process.exit(1);
});
