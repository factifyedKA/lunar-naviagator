// Full-year simulation for every listed site.
//
//   node tools/simulate.mjs [year]        (default 2027)
//
// Steps hourly through the year with the real-terrain horizon masks (data/horizons.json),
// saves the headline numbers to data/year-sim.json (the app loads this instantly for its
// ranking table) and prints a ranking.
import { readFileSync, writeFileSync } from 'node:fs';
import { SITES } from '../js/sites.js';
import { computeSeries, summarize, compositeScore, DEFAULT_WEIGHTS, fmtDuration } from '../js/metrics.js';

const year = Number(process.argv[2]) || 2027;
const dataDir = new URL('../data/', import.meta.url);
const horizons = JSON.parse(readFileSync(new URL('horizons.json', dataDir))).sites;

const start = Date.UTC(year, 0, 1);
const hours = (Date.UTC(year + 1, 0, 1) - start) / 3600e3;
const EMIN = 0;

function run(models) {
  return computeSeries(models, start, hours, EMIN).map((s) => summarize(s));
}
const t0 = Date.now();
const terrain = run(SITES.map((s) => {
  const h = horizons[s.id];
  return { lat: h.lat, lon: h.lon, heightKm: h.height / 1000, mask: h.mask };
}));
const flat = run(SITES.map((s) => ({ lat: s.lat, lon: s.lon, heightKm: 0, mask: null, hz: 0 })));
const ms = Date.now() - t0;

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
const result = {
  year, start: new Date(start).toISOString(), hours, stepHours: 1, earthMinElevation: EMIN,
  note: 'terrain = NASA LOLA 240 m horizon masks, observer 2 m above the highest ground near the marker; flat = ideal smooth sphere at the marker',
  sites: Object.fromEntries(SITES.map((s, i) => [s.id, { terrain: round(terrain[i]), flat: round(flat[i]) }])),
};
writeFileSync(new URL('year-sim.json', dataDir), JSON.stringify(result));

const rows = SITES.map((s, i) => ({ s, m: terrain[i], f: flat[i], score: compositeScore(terrain[i], DEFAULT_WEIGHTS).score }))
  .sort((a, b) => b.score - a.score);
console.log(`Year ${year}, hourly, ${SITES.length} sites x 2 horizon models in ${ms} ms\n`);
console.log('Rank Site                   Score  Sunlit%  LongestDark  Earth%  LongestGap  Both%   (flat: Sunlit% Earth%)');
rows.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(3)}  ${r.s.name.padEnd(22)} ${r.score.toFixed(1).padStart(5)}  ${r.m.sunlitPct.toFixed(1).padStart(6)}  `
    + `${fmtDuration(r.m.longestDarkH).padStart(10)}  ${r.m.earthPct.toFixed(1).padStart(6)}  ${fmtDuration(r.m.longestOutageH).padStart(9)}  `
    + `${r.m.overlapPct.toFixed(1).padStart(5)}        ${r.f.sunlitPct.toFixed(1).padStart(5)}  ${r.f.earthPct.toFixed(1).padStart(5)}`);
});
