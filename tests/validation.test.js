// Tests against the NASA reference files used by the Validation page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skyAtTime } from '../js/astro.js';
import { computeSeries, summarize, nextChange } from '../js/metrics.js';
import { SITES } from '../js/sites.js';

const json = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)));

test('Sun and Earth positions agree with NASA JPL Horizons within 0.02°', () => {
  const ref = json('validation-horizons.json');
  assert.equal(ref.rows.length, 110);
  let worst = 0;
  for (const r of ref.rows) {
    const ours = skyAtTime(new Date(r.time), r.lat, r.lon)[r.body.toLowerCase()];
    const dAz = Math.abs(((ours.az - r.az + 540) % 360) - 180) * Math.cos(r.el * Math.PI / 180);
    worst = Math.max(worst, dAz, Math.abs(ours.el - r.el));
  }
  assert.ok(worst < 0.02, `worst difference ${worst.toFixed(4)}°`);
});

test('terrain sunlight and Earth visibility agree with NASA LOLA maps within 10 points', () => {
  const ref = json('validation-nasa-illumination.json');
  const h = json('horizons.json').sites;
  const sites = SITES.filter((s) => s.id !== 'pole');
  const models = sites.map((s) => ({ lat: h[s.id].lat, lon: h[s.id].lon, heightKm: h[s.id].height / 1000, mask: h[s.id].mask }));
  const series = computeSeries(models, Date.UTC(2027, 0, 1), 8760, -0.95);
  sites.forEach((s, i) => {
    const ours = summarize(series[i]);
    assert.ok(Math.abs(ours.sunlitPct - ref.sites[s.id].sunPct) <= 10, `${s.name} sunlit: ours ${ours.sunlitPct.toFixed(1)} vs NASA ${ref.sites[s.id].sunPct}`);
    assert.ok(Math.abs(ours.earthPct - ref.sites[s.id].earthPct) <= 10, `${s.name} Earth: ours ${ours.earthPct.toFixed(1)} vs NASA ${ref.sites[s.id].earthPct}`);
  });
  for (const p of Object.values(ref.craterFloors)) assert.equal(p.sunPct, 0); // NASA: permanent shadow
});

test('nextChange finds the moment the Sun or the Earth appears or disappears', () => {
  // 85°S: far enough from the pole that the Sun and the Earth both rise and set every month
  const flat = { lat: -85, lon: 0, heightKm: 0, mask: null, hz: 0 };
  const t = Date.UTC(2027, 0, 1);
  for (const kind of ['sun', 'earth']) {
    const r = nextChange(flat, t, 0, kind);
    assert.ok(r.at > t && r.at < t + 30 * 86400e3, `${kind} changes within a month at 85°S`);
    const state = (ms) => nextChange(flat, ms, 0, kind).now;
    assert.equal(state(r.at - 120e3), r.now);       // two minutes before: unchanged
    assert.notEqual(state(r.at + 120e3), r.now);    // two minutes after: switched
  }
  const wall = { lat: -89, lon: 0, heightKm: 0, mask: new Float32Array(360).fill(30) };
  assert.deepEqual(nextChange(wall, t, 0, 'sun', 20), { now: false, at: null }); // never any Sun behind a 30° wall
});
