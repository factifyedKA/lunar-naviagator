// Builds the terrain files the app uses from the NASA LRO/LOLA polar elevation model.
//
//   node tools/build-terrain.mjs <folder containing ldem_75s_240m.img>
//
// Input  (NOT committed, 29 MB): LDEM_75S_240M.IMG, NASA PDS Geosciences Node,
//         data set LRO-L-LOLA-4-GDR-V1.0 (LOLA team, NASA Goddard), 240 m/pixel,
//         polar stereographic, 75°S–90°S.
//         https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
// Output (committed, small):
//   data/horizons.json       horizon mask (360 directions) for every listed site, from the 240 m model
//   data/dem_75s_960m.bin    the same model averaged down to 960 m (int16 metres) for custom points
//   data/terrain.json        description of the files above
//   data/relief_80s.png      shaded-relief picture of 80°S–90°S for the map
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { join, resolve } from 'node:path';
import { SITES } from '../js/sites.js';
import { makeDem, demHeight, highestNear, horizonMask } from '../js/terrain.js';

const srcDir = resolve(process.argv[2] || '.');
const out = resolve(new URL('../data', import.meta.url).pathname);
mkdirSync(out, { recursive: true });

const SIZE = 3812;
const buf = readFileSync(join(srcDir, 'ldem_75s_240m.img'));
if (buf.length !== SIZE * SIZE * 2) throw new Error('unexpected file size');
const dem = makeDem(new Int16Array(buf.buffer, buf.byteOffset, SIZE * SIZE), SIZE, 240, 0.5);

// ---- 1. horizon masks for the listed sites --------------------------------------------
// The observer stands on the highest ground near the marker (planners favour high ground
// for light and radio). Search radius: see SNAP_KM in js/sites.js / DECISIONS.md.
const OBS_HEIGHT_M = 2;
const horizons = {};
for (const s of SITES) {
  const p = s.snapKm > 0 ? highestNear(dem, s.lat, s.lon, s.snapKm) : { lat: s.lat, lon: s.lon };
  const { mask, height } = horizonMask(dem, p.lat, p.lon, { obsHeight: OBS_HEIGHT_M });
  horizons[s.id] = {
    lat: Number(p.lat.toFixed(4)), lon: Number(p.lon.toFixed(4)), height: Math.round(height),
    markerHeight: Math.round(demHeight(dem, s.lat, s.lon)),
    mask: Array.from(mask, (v) => Number(v.toFixed(2))),
  };
  const m = horizons[s.id].mask;
  console.log(`${s.name.padEnd(22)} ground ${String(horizons[s.id].height).padStart(6)} m  (marker ${String(horizons[s.id].markerHeight).padStart(6)} m)`
    + `  horizon min ${Math.min(...m).toFixed(2)}°  max ${Math.max(...m).toFixed(2)}°`);
}
writeFileSync(join(out, 'horizons.json'), JSON.stringify({
  source: 'NASA LRO/LOLA LDEM_75S_240M (LRO-L-LOLA-4-GDR-V1.0)', metresPerPixel: 240, observerHeightM: OBS_HEIGHT_M,
  note: 'mask[i] = terrain horizon elevation in degrees at azimuth i (0 = north, clockwise)', sites: horizons,
}));

// ---- 2. coarse model for custom points (4x4 average -> 960 m) --------------------------
const F = 4;
const CS = SIZE / F;
const coarse = new Int16Array(CS * CS);
for (let r = 0; r < CS; r++) {
  for (let c = 0; c < CS; c++) {
    let sum = 0;
    for (let dr = 0; dr < F; dr++) for (let dc = 0; dc < F; dc++) sum += dem.data[(r * F + dr) * SIZE + c * F + dc];
    coarse[r * CS + c] = Math.round((sum / (F * F)) * 0.5); // whole metres
  }
}
writeFileSync(join(out, 'dem_75s_960m.bin'), Buffer.from(coarse.buffer));

// ---- 3. shaded relief picture for the map (80°S–90°S) ----------------------------------
const PX = 1024;
const HALF = 2 * 1737400 * Math.tan((10 / 2) * Math.PI / 180); // metres from pole to 80°S
const mpp = (2 * HALF) / PX;
const hAt = (i, j) => { // height at output pixel (bilinear in the 240 m grid)
  const col = dem.c0 + ((i + 0.5) * mpp - HALF) / 240;
  const row = dem.c0 + ((j + 0.5) * mpp - HALF) / 240;
  const c0 = Math.floor(col), r0 = Math.floor(row), fc = col - c0, fr = row - r0, k = r0 * SIZE + c0;
  const d = dem.data;
  return ((d[k] * (1 - fc) + d[k + 1] * fc) * (1 - fr) + (d[k + SIZE] * (1 - fc) + d[k + SIZE + 1] * fc) * fr) * 0.5;
};
const raw = Buffer.alloc((PX + 1) * PX);
const light = [-0.5, -0.5, 0.707]; // artificial light from the upper left, 45° high
const EXAG = 2.5;                   // slopes exaggerated so gentle relief is visible
for (let j = 0; j < PX; j++) {
  raw[j * (PX + 1)] = 0; // PNG filter byte
  for (let i = 0; i < PX; i++) {
    const dzdx = (EXAG * (hAt(i + 1, j) - hAt(i - 1, j))) / (2 * mpp);
    const dzdy = (EXAG * (hAt(i, j + 1) - hAt(i, j - 1))) / (2 * mpp);
    const n = Math.hypot(dzdx, dzdy, 1);
    const shade = Math.max(0, (-dzdx * light[0] - dzdy * light[1] + light[2]) / n);
    const tint = Math.max(0, Math.min(1, (hAt(i, j) + 5000) / 12000));   // higher = a little brighter
    raw[j * (PX + 1) + 1 + i] = Math.round(255 * Math.min(1, 0.04 + 0.78 * shade ** 1.6 + 0.18 * tint));
  }
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(PX, 0); ihdr.writeUInt32BE(PX, 4); ihdr[8] = 8; ihdr[9] = 0; // 8-bit greyscale
writeFileSync(join(out, 'relief_80s.png'), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]));

writeFileSync(join(out, 'terrain.json'), JSON.stringify({
  source: 'NASA LRO/LOLA LDEM_75S_240M, data set LRO-L-LOLA-4-GDR-V1.0, NASA PDS Geosciences Node',
  coarseDem: { file: 'dem_75s_960m.bin', size: CS, metresPerPixel: 240 * F, type: 'int16 little-endian, metres above the 1737.4 km sphere', minLatitude: -75 },
  relief: { file: 'relief_80s.png', size: PX, edgeLatitude: -80, note: 'shaded relief with artificial lighting from the upper left' },
}, null, 1));
console.log('Terrain files written to', out);
