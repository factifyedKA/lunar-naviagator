// Tests for the site data and the URL state (share-by-link).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES, FEATURES, getSite, LAT_MIN, LAT_MAX } from '../js/sites.js';
import { defaultState, encodeState, decodeState } from '../js/state.js';

test('sites: unique ids, inside the 80S-90S cap, numbered 1..n', () => {
  const ids = new Set(SITES.map((s) => s.id));
  assert.equal(ids.size, SITES.length);
  SITES.forEach((s, i) => {
    assert.ok(s.lat >= LAT_MIN && s.lat <= LAT_MAX, `${s.name} latitude`);
    assert.ok(s.lon >= -180 && s.lon <= 180, `${s.name} longitude`);
    assert.equal(s.n, i + 1);
    assert.ok(s.name && s.blurb);
  });
  assert.equal(SITES.filter((s) => s.group === 'artemis2024').length, 9);
  // every Artemis marker must carry the "approximate" label (see DECISIONS.md)
  assert.ok(SITES.filter((s) => s.id !== 'pole').every((s) => s.approx === true));
  FEATURES.forEach((f) => assert.ok(f.lat < -80 && f.d > 0));
});

test('getSite: custom point and unknown id fallback', () => {
  assert.equal(getSite('custom', -88, 10).lat, -88);
  assert.equal(getSite('nope').id, 'malapert');
});

test('state: URL round trip keeps everything', () => {
  const s = { ...defaultState(Date.UTC(2026, 10, 14, 13)), site: 'custom', lat: -88.123, lon: 45.5, hz: 1.5, speed: 'day', zoom: 2 };
  const back = decodeState(encodeState(s));
  for (const k of ['view', 'site', 'lat', 'lon', 't', 't0', 'hz', 'speed', 'zoom']) assert.equal(back[k], s[k], k);
  const full = { ...s, hm: 'flat', emin: 2.5, rs: Date.UTC(2027, 2, 1), rd: 180, w: [5, 0, 1, 2, 3], ml: 30, sc: 'site', fd: 365,
    cmp: [{ id: 'ridge', start: Date.UTC(2027, 0, 1) }, null, { id: 'custom', start: Date.UTC(2027, 5, 1) }, null] };
  const back2 = decodeState(encodeState(full));
  for (const k of ['hm', 'emin', 'rs', 'rd', 'ml', 'sc', 'fd']) assert.equal(back2[k], full[k], k);
  assert.deepEqual(back2.w, full.w);
  assert.deepEqual(back2.cmp, full.cmp);
});

test('state: bad URLs fall back to safe defaults', () => {
  const now = Date.UTC(2026, 10, 14, 13);
  const d = defaultState(now);
  const s = decodeState('#s=<script>&t=garbage&hz=999&z=-4&c=12,abc&v=../x', now);
  assert.equal(s.site, d.site);
  assert.equal(s.t, d.t);
  assert.equal(s.hz, 5);
  assert.equal(s.zoom, 0);
  assert.equal(s.lat, -80);     // clamped into the map area
  assert.equal(s.view, 'explore');
});
