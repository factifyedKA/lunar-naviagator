// Builds the whole-Moon shaded-relief texture for the 3D view from NASA's global LOLA
// elevation model.
//
//   node tools/build-global-relief.mjs <folder containing ldem_4.img>
//
// Input (not committed, 2 MB): LDEM_4.IMG — LRO LOLA gridded data record, simple
// cylindrical, 4 pixels per degree (1440 x 720), heights in half-metres, longitude 0-360
// from the left edge, 90°N at the top. NASA PDS Geosciences Node,
// .../lrolol_1xxx/data/lola_gdr/cylindrical/img/
// Output: data/relief_global.png — 1440 x 720 greyscale, longitude -180..180 (0° in the
// middle), artificial lighting from the upper left.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { join, resolve } from 'node:path';

const Wd = 1440, Ht = 720;
const buf = readFileSync(join(resolve(process.argv[2] || '.'), 'ldem_4.img'));
if (buf.length !== Wd * Ht * 2) throw new Error('unexpected file size');
const dn = new Int16Array(buf.buffer, buf.byteOffset, Wd * Ht);
const h = (col, row) => dn[Math.max(0, Math.min(Ht - 1, row)) * Wd + ((col % Wd) + Wd) % Wd] * 0.5; // metres, wraps in longitude

const CELL = (Math.PI / 180) * 1737400 / 4; // metres per pixel north-south
const EXAG = 9;                              // slopes exaggerated: at 7.6 km per pixel real slopes look flat
const light = [-0.5, -0.5, 0.707];
const raw = Buffer.alloc((Wd + 1) * Ht);
for (let row = 0; row < Ht; row++) {
  const lat = 90 - (row + 0.5) / 4;
  const dx = CELL * Math.max(0.3, Math.cos(lat * Math.PI / 180)); // (limited near the poles, where columns bunch up)
  for (let i = 0; i < Wd; i++) {
    const col = i + Wd / 2;                  // output starts at longitude -180 = input column 720
    const dzdx = (EXAG * (h(col + 1, row) - h(col - 1, row))) / (2 * dx);
    const dzdy = (EXAG * (h(col, row + 1) - h(col, row - 1))) / (2 * CELL);
    const n = Math.hypot(dzdx, dzdy, 1);
    const shade = Math.max(0, (-dzdx * light[0] - dzdy * light[1] + light[2]) / n);
    const tint = Math.max(0, Math.min(1, (h(col, row) + 6000) / 14000));
    raw[row * (Wd + 1) + 1 + i] = Math.round(255 * Math.min(1, 0.04 + 0.78 * shade ** 1.6 + 0.18 * tint));
  }
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(Wd, 0); ihdr.writeUInt32BE(Ht, 4); ihdr[8] = 8; ihdr[9] = 0;
writeFileSync(new URL('../data/relief_global.png', import.meta.url), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log('data/relief_global.png written');
