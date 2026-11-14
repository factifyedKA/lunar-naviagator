// Reads NASA's own long-term illumination and Earth-visibility maps at our site viewpoints
// and saves the values to data/validation-nasa-illumination.json for the Validation page.
//
//   NODE_USE_ENV_PROXY=1 node tools/fetch-nasa-illumination.mjs
//
// Maps: AVGVISIB_65S_240M_201608 (average visible fraction of the solar disc) and
// AVGVISIB_65S_240M_201608_EARTH (average Earth visibility), LOLA team, NASA Goddard,
// "extras/illumination/release_2016" of the LRO LOLA archive at the NASA PDS Geosciences
// Node. Hourly steps over 18.6 years, at the surface, 240 m/pixel polar stereographic
// (Mazarico et al., 2011, Icarus 211, 1066-1081).
// The files are 82 MB each, so only the few pixels needed are downloaded (HTTP Range).
import { readFileSync, writeFileSync } from 'node:fs';
import { SITES } from '../js/sites.js';

const BASE = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/';
const FILES = { sun: 'avgvisib_65s_240m_201608.img', earth: 'avgvisib_65s_240m_201608_earth.img' };
const SIZE = 6420, C0 = 3209.5, MPP = 240, SCALE = 0.00004, R = 1737400, D2R = Math.PI / 180;

// The label says CENTER_LONGITUDE = 180, but the grid is laid out like the LOLA elevation
// maps (0° longitude towards the top, 90°E to the right). ORIENT = +1 encodes that; it was
// confirmed with known places (see the check printed below).
const ORIENT = Number(process.env.ORIENT || 1);
function pixel(lat, lon) {
  const r = 2 * R * Math.tan(((90 + lat) / 2) * D2R);
  return [Math.round(C0 + ORIENT * (r * Math.sin(lon * D2R)) / MPP), Math.round(C0 - ORIENT * (r * Math.cos(lon * D2R)) / MPP)];
}
async function read(file, col, row, n = 1) { // n pixels of one row, as fractions 0..1
  const start = (row * SIZE + col) * 2;
  const res = await fetch(BASE + file, { headers: { Range: `bytes=${start}-${start + n * 2 - 1}` } });
  if (res.status !== 206) throw new Error(`range request failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return Array.from({ length: n }, (_, i) => buf.readInt16LE(i * 2) * SCALE);
}
/** value at the pixel and the largest value in the 3x3 block around it */
async function sample(file, lat, lon) {
  const [c, r] = pixel(lat, lon);
  const rows = await Promise.all([-1, 0, 1].map((d) => read(file, c - 1, r + d, 3)));
  return { at: rows[1][1], max3: Math.max(...rows.flat()) };
}

const horizons = JSON.parse(readFileSync(new URL('../data/horizons.json', import.meta.url))).sites;
const pct = (v) => Math.round(v * 1000) / 10;
const sites = {};
for (const s of SITES) {
  const h = horizons[s.id];
  const [sun, earth] = await Promise.all([sample(FILES.sun, h.lat, h.lon), sample(FILES.earth, h.lat, h.lon)]);
  sites[s.id] = { lat: h.lat, lon: h.lon, sunPct: pct(sun.at), sunMax3Pct: pct(sun.max3), earthPct: pct(earth.at), earthMax3Pct: pct(earth.max3) };
  console.log(s.name.padEnd(22), 'NASA sun', String(sites[s.id].sunPct).padStart(5), '% (3x3 max', sites[s.id].sunMax3Pct, ')  Earth', sites[s.id].earthPct, '%');
}
const floors = {};
for (const [name, lat, lon] of [['Shackleton floor', -89.67, 129.78], ['Haworth floor', -87.45, -5.17], ['Faustini floor', -87.3, 77.0], ['Shoemaker floor', -88.1, 44.9]]) {
  floors[name] = { lat, lon, sunPct: pct((await sample(FILES.sun, lat, lon)).max3) };
  console.log(name.padEnd(22), 'NASA sun', floors[name].sunPct, '% (0 = permanent shadow)');
}
writeFileSync(new URL('../data/validation-nasa-illumination.json', import.meta.url), JSON.stringify({
  source: 'NASA LRO/LOLA average illumination and Earth visibility maps AVGVISIB_65S_240M_201608[_EARTH].IMG (LOLA archive extras, release 2016, NASA PDS Geosciences Node)',
  method: 'hourly steps over 18.6 years, at the surface, 240 m/pixel; Earth counted visible if any part of its disc is unobscured (Mazarico et al. 2011)',
  retrieved: new Date().toISOString().slice(0, 10),
  note: 'sunPct/earthPct = value at the map pixel of our terrain viewpoint; *Max3Pct = largest value in the 3x3 pixels around it',
  sites, craterFloors: floors,
}));
