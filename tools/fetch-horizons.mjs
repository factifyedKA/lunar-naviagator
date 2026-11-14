// Downloads reference Sun and Earth positions from NASA JPL Horizons for points on the
// Moon and saves them to data/validation-horizons.json for the Validation page and tests.
//
//   node tools/fetch-horizons.mjs
//
// Horizons API: https://ssd.jpl.nasa.gov/api/horizons.api  (observer table, quantity 4 =
// apparent azimuth and elevation; observer = a longitude/latitude on body 301, the Moon,
// at 0 km altitude; no refraction, the Moon has no air).
import { writeFileSync } from 'node:fs';

const POINTS = [ // marker coordinates (not the terrain viewpoints): this is a pure astronomy check
  { name: 'Malapert Massif marker', lat: -85.96, lon: -2.3 },
  { name: 'Connecting Ridge marker', lat: -89.45, lon: -137.31 },
  { name: 'Nobile Rim 2 marker', lat: -84.0, lon: 58.7 },
  { name: 'Slater Plain marker', lat: -87.5, lon: 113.0 },
  { name: 'Peak near Cabeus B marker', lat: -83.6, lon: -68.6 },
];
const BODIES = [{ name: 'Sun', id: '10' }, { name: 'Earth', id: '399' }];
const START = '2026-12-01 00:00';
const STOP = '2028-12-01 00:00';
const STEP = '73 d';
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const rows = [];
for (const p of POINTS) {
  for (const b of BODIES) {
    const q = new URLSearchParams({
      format: 'text', COMMAND: `'${b.id}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
      CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${p.lon},${p.lat},0'`,
      START_TIME: `'${START}'`, STOP_TIME: `'${STOP}'`, STEP_SIZE: `'${STEP}'`,
      QUANTITIES: "'4'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'",
    });
    const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`);
    const text = await res.text();
    const block = text.split('$$SOE')[1]?.split('$$EOE')[0];
    if (!block) throw new Error(`Horizons gave no table for ${p.name} / ${b.name}:\n${text.slice(0, 600)}`);
    for (const line of block.trim().split('\n')) {
      const c = line.split(',').map((x) => x.trim());
      const m = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/.exec(c[0]);
      const time = new Date(Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5])).toISOString();
      rows.push({ point: p.name, lat: p.lat, lon: p.lon, body: b.name, time, az: Number(c[3]), el: Number(c[4]) });
    }
    console.log(`${p.name} / ${b.name}: ok`);
  }
}
const frame = /Center pole\/equ[^\n]*/.exec(await (await fetch(
  "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='10'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='0,-89,0'&START_TIME='2027-01-01'&STOP_TIME='2027-01-02'&STEP_SIZE='1 d'&QUANTITIES='4'")).text());
writeFileSync(new URL('../data/validation-horizons.json', import.meta.url), JSON.stringify({
  source: 'NASA JPL Horizons System, https://ssd.jpl.nasa.gov/horizons/ (API version 1.2)',
  retrieved: new Date().toISOString().slice(0, 10),
  settings: `observer table, QUANTITIES=4 (apparent azimuth & elevation), CENTER=coord@301 (Moon surface), altitude 0 km, ${START} to ${STOP} step ${STEP}`,
  moonFrameReportedByHorizons: frame ? frame[0].trim() : 'not reported',
  rows,
}, null, 0));
console.log(`${rows.length} reference rows saved.`, frame ? frame[0].trim() : '');
