// Tests for terrain horizons, visibility metrics, scores and the pre-computed data files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeDem, demPixel, demLatLon, demHeight, highestNear, horizonMask, maskAt } from '../js/terrain.js';
import { computeSeries, summarize, compositeScore, visibility, fmtDuration, findWindows, topWindows, DEFAULT_WEIGHTS } from '../js/metrics.js';
import { skyAtTime } from '../js/astro.js';
import { SITES } from '../js/sites.js';

const json = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)));

// a synthetic 400 x 400 grid, 500 m per pixel, built from a height function of (lat, lon)
function synthDem(heightFn) {
  const size = 400;
  const dem = makeDem(new Float32Array(size * size), size, 500, 1);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const p = demLatLon(dem, c, r);
    dem.data[r * size + c] = heightFn(p.lat, p.lon);
  }
  return dem;
}

test('terrain: grid position <-> latitude/longitude round trip, 0° longitude is up, 90°E is right', () => {
  const dem = makeDem(new Int16Array(4), 2001, 240, 0.5);
  const [c, r] = demPixel(dem, -88, 90);
  assert.ok(c > dem.c0 && Math.abs(r - dem.c0) < 1e-9);
  assert.ok(demPixel(dem, -88, 0)[1] < dem.c0);
  const back = demLatLon(dem, c, r);
  assert.ok(Math.abs(back.lat + 88) < 1e-9 && Math.abs(back.lon - 90) < 1e-9);
});

test('terrain: on a perfectly smooth Moon the horizon dips by the textbook amount', () => {
  const dem = synthDem(() => 0);
  const { mask } = horizonMask(dem, -89, 30, { obsHeight: 100, maxKm: 80 });
  const expected = -Math.acos(1737400 / 1737500) * 180 / Math.PI; // -0.615°
  for (const v of mask) assert.ok(Math.abs(v - expected) < 0.03, `${v} vs ${expected}`);
});

test('terrain: a 1 km hill 10 km to the north blocks the north, not the south', () => {
  // hill centred 10 km north of the site (north = towards lon 0 on the 0° meridian... use the site's own meridian)
  const site = { lat: -88, lon: 0 };
  const hillLat = site.lat + 10 / 30.32; // 10 km north
  const dem = synthDem((lat, lon) => {
    const dLat = (lat - hillLat) * 30.32;
    const dLon = lon * Math.cos(lat * Math.PI / 180) * 30.32;
    return 1000 * Math.exp(-(dLat * dLat + dLon * dLon) / (2 * 2 * 2));
  });
  const { mask, height } = horizonMask(dem, site.lat, site.lon, { obsHeight: 2, maxKm: 80 });
  assert.ok(Math.abs(height) < 1);
  assert.ok(mask[0] > 4.8 && mask[0] < 5.8, `north horizon ${mask[0]}°`); // atan(1000/10000) = 5.7° minus curvature
  assert.ok(mask[180] < 0.05, `south horizon ${mask[180]}°`);
  assert.ok(Math.abs(maskAt(mask, 359.5) - (mask[359] + mask[0]) / 2) < 1e-6); // wraps around north
  const top = highestNear(dem, site.lat, site.lon, 15);
  assert.ok(Math.abs(top.lat - hillLat) < 0.03 && top.height > 950);
  assert.ok(Number.isNaN(demHeight(dem, -80, 0))); // outside the grid
});

test('metrics: summarize finds percentages and longest runs', () => {
  const sunFrac = Float32Array.from([1, 1, 0.5, 0, 0, 0, 1, 0, 1, 1]);
  const earthUp = Uint8Array.from([1, 0, 0, 0, 0, 1, 1, 1, 1, 0]);
  const m = summarize({ sunFrac, earthUp });
  assert.ok(Math.abs(m.sunlitPct - 55) < 1e-6);
  assert.equal(m.longestDarkH, 3);
  assert.equal(m.darkStart, 3);
  assert.equal(m.earthPct, 50);
  assert.equal(m.longestOutageH, 4);
  assert.equal(m.outageStart, 1);
  assert.equal(m.overlapPct, 30);
  const part = summarize({ sunFrac, earthUp }, 1, 6, 4); // sub-range used by the window finder
  assert.equal(part.longestDarkH, 1);
  assert.equal(part.earthPct, 75);
});

test('metrics: composite score is explainable and bounded', () => {
  const perfect = { sunlitPct: 100, longestDarkH: 0, earthPct: 100, longestOutageH: 0, overlapPct: 100 };
  const worst = { sunlitPct: 0, longestDarkH: 9999, earthPct: 0, longestOutageH: 9999, overlapPct: 0 };
  assert.equal(compositeScore(perfect).score, 100);
  assert.equal(compositeScore(worst).score, 0);
  const mixed = { sunlitPct: 80, longestDarkH: 90, earthPct: 50, longestOutageH: 180, overlapPct: 40 };
  const c = compositeScore(mixed, [3, 2, 2, 1, 2]);
  assert.ok(Math.abs(c.parts.reduce((a, p) => a + p.points, 0) - c.score) < 1e-9); // points add up to the score
  assert.ok(Math.abs(c.score - (80 * 3 + 75 * 2 + 50 * 2 + 50 * 1 + 40 * 2) / 10) < 1e-9);
  assert.equal(compositeScore(mixed, [1, 0, 0, 0, 0]).score, 80);          // only sunlight counts
  assert.equal(compositeScore(mixed, [0, 0, 0, 0, 0]).score, 0);           // no division by zero
  assert.equal(fmtDuration(77), '3 d 5 h');
  assert.equal(fmtDuration(7), '7 h');
});

test('metrics: visibility respects the horizon, the Earth margin and eclipses', () => {
  const sky = skyAtTime(new Date('2026-11-20T06:00Z'), -85.96, -2.3); // Sun +4.0°, Earth +7.5°
  assert.equal(visibility(sky, { mask: null, hz: 0 }).sunFrac, 1);
  assert.equal(visibility(sky, { mask: null, hz: 5 }).sunFrac, 0);
  assert.equal(visibility(sky, { mask: null, hz: 0 }, 5).earthUp, true);
  assert.equal(visibility(sky, { mask: null, hz: 0 }, 9).earthUp, false);
  const wall = new Float32Array(360).fill(20);
  assert.equal(visibility(sky, { mask: wall }).earthUp, false);
  const ecl = visibility(skyAtTime(new Date('2026-03-03T11:34Z'), -85.96, -2.3), { mask: null, hz: -5 });
  assert.equal(ecl.eclipse, true);
  assert.equal(ecl.sunFrac, 0); // total lunar eclipse: Earth covers the Sun
});

test('data: horizons.json has a 360-value mask for every site', () => {
  const h = json('horizons.json');
  for (const s of SITES) {
    const e = h.sites[s.id];
    assert.ok(e, s.id);
    assert.equal(e.mask.length, 360);
    assert.ok(e.mask.every((v) => v > -8 && v < 45));
    assert.ok(Math.abs(e.lat - s.lat) < 0.2, `${s.id} viewpoint stays near its marker`);
  }
});

test('data: year-sim.json matches a fresh calculation and known physics', () => {
  const sim = json('year-sim.json');
  const h = json('horizons.json').sites;
  const model = (id) => ({ lat: h[id].lat, lon: h[id].lon, heightKm: h[id].height / 1000, mask: h[id].mask });
  const [ridge] = computeSeries([model('ridge')], Date.parse(sim.start), sim.hours, 0);
  const fresh = summarize(ridge);
  for (const k of ['sunlitPct', 'earthPct', 'overlapPct', 'longestDarkH', 'longestOutageH']) {
    assert.ok(Math.abs(fresh[k] - sim.sites.ridge.terrain[k]) < 0.01, k);
  }
  // Known from NASA LOLA illumination studies (Mazarico et al. 2011): the ridge and rim near
  // Shackleton are sunlit most of the time; Malapert Massif always sees the Earth.
  assert.ok(sim.sites.ridge.terrain.sunlitPct > 80);
  assert.ok(sim.sites['shackleton-rim'].terrain.sunlitPct > 80);
  assert.ok(sim.sites.malapert.terrain.earthPct > 99);
  // on an ideal smooth sphere every polar site is sunlit about half the time
  for (const s of SITES) assert.ok(Math.abs(sim.sites[s.id].flat.sunlitPct - 50) < 4, s.id);
  assert.ok(compositeScore(sim.sites.malapert.terrain, DEFAULT_WEIGHTS).score > compositeScore(sim.sites.haworth.terrain, DEFAULT_WEIGHTS).score);
});

test('best-window finder: finds the sunny, Earth-visible stretch and never returns overlapping windows', () => {
  // 40 days of hourly samples: dark and silent, except days 10-20 which are perfect
  const n = 40 * 24 + 1;
  const sunFrac = new Float32Array(n);
  const earthUp = new Uint8Array(n);
  for (let i = 10 * 24; i < 20 * 24; i++) { sunFrac[i] = 1; earthUp[i] = 1; }
  const wins = findWindows({ sunFrac, earthUp }, 5 * 24);
  assert.equal(wins.length, 36);                       // one start per day while the mission still fits
  assert.equal(wins[0].start, 0);
  const top = topWindows(wins, 3, 5 * 24);
  assert.equal(top[0].score, 100);
  assert.ok(top[0].start >= 10 * 24 && top[0].start <= 15 * 24);
  assert.equal(top[1].score, 100);                     // a second, non-overlapping perfect window exists
  for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) {
    assert.ok(Math.abs(top[a].start - top[b].start) >= 5 * 24, 'windows must not overlap');
  }
  assert.ok(top[2].score < 100);
  // windows of different sites may share dates
  const tagged = [...wins.map((w) => ({ ...w, site: 'a' })), ...wins.map((w) => ({ ...w, site: 'b' }))];
  const both = topWindows(tagged, 4, 5 * 24, (w) => w.site);
  assert.equal(both.filter((w) => w.score === 100).length, 4);
  assert.deepEqual(findWindows({ sunFrac, earthUp }, 60 * 24), []); // mission longer than the search period
});

test('best-window finder on real data: the best 14 days at the Connecting Ridge beat the worst', () => {
  const h = json('horizons.json').sites.ridge;
  const [series] = computeSeries([{ lat: h.lat, lon: h.lon, heightKm: h.height / 1000, mask: h.mask }], Date.UTC(2027, 0, 1), 120 * 24, 0);
  const wins = findWindows(series, 14 * 24, DEFAULT_WEIGHTS);
  const scores = wins.map((w) => w.score);
  const best = topWindows(wins, 1, 14 * 24)[0];
  assert.equal(best.score, Math.max(...scores));
  assert.ok(best.score - Math.min(...scores) > 5, 'start date matters');
  // the window summary equals a direct summary of the same hours
  const direct = summarize(series, 1, best.start, 14 * 24);
  assert.deepEqual(best.summary, direct);
});
