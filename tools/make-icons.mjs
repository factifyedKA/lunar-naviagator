// Draws the app icons (a simple Moon with a Sun and an Earth dot) as PNG files.
//   node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
const BG = [11, 15, 26], MOON = [207, 214, 228], CRATER = [150, 159, 178], SUN = [240, 228, 66], EARTH = [86, 180, 233];
const disc = (x, y, cx, cy, r, soft = 0.006) => 1 - Math.max(0, Math.min(1, (Math.hypot(x - cx, y - cy) - r) / soft)); // 1 inside, 0 outside

function pixel(x, y) {
  let c = BG;
  c = mix(c, MOON, disc(x, y, 0.5, 0.54, 0.31));
  for (const [cx, cy, r] of [[0.4, 0.46, 0.085], [0.6, 0.64, 0.105], [0.62, 0.4, 0.045], [0.38, 0.68, 0.04]]) c = mix(c, CRATER, disc(x, y, cx, cy, r));
  c = mix(c, SUN, disc(x, y, 0.2, 0.2, 0.07));
  c = mix(c, EARTH, disc(x, y, 0.82, 0.22, 0.055));
  return c;
}

const out = new URL('../icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const size of [180, 192, 512]) writeFileSync(new URL(`icon-${size}.png`, out), png(size, pixel));
console.log('icons written');
