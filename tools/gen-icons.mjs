// Bir kerelik geliştirme aracı: basit pin ikonunu çeşitli boyutlarda
// PNG olarak üretir (uygulamanın çalışma zamanının parçası değil).
// Çalıştırma: npm run gen-icons
import PImage from 'pureimage';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACCENT = '#0a84ff';

/** @param {number} size */
function drawIcon(size) {
  const img = PImage.make(size, size);
  const ctx = img.getContext('2d');

  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  const cx = size / 2;
  const headCy = size * 0.4;
  const headR = size * 0.2;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.85, headCy + headR * 0.55);
  ctx.lineTo(cx + headR * 0.85, headCy + headR * 0.55);
  ctx.lineTo(cx, size * 0.78);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(cx, headCy, headR * 0.42, 0, Math.PI * 2);
  ctx.fill();

  return img;
}

/**
 * @param {ReturnType<typeof PImage.make>} img
 * @param {string} outPath
 */
async function writePng(img, outPath) {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  const stream = fs.createWriteStream(outPath);
  await PImage.encodePNGToStream(img, stream);
  console.log('yazıldı:', path.relative(ROOT, outPath));
}

await writePng(drawIcon(192), path.join(ROOT, 'icons/icon-192.png'));
await writePng(drawIcon(512), path.join(ROOT, 'icons/icon-512.png'));
await writePng(drawIcon(180), path.join(ROOT, 'icons/apple-touch-icon.png'));
