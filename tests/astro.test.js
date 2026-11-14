// Tests for the Sun/Earth sky maths. These are physical sanity checks plus a
// cross-check against an INDEPENDENT libration model (Astronomy.Libration, which follows
// Meeus/Eckhardt rather than the IAU rotation series used by js/astro.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from '../vendor/astronomy.js';
import {
  moonFrame, skyAt, skyAtTime, subEarthPoint, subSolarPoint, discFractionVisible,
  meanEarthAzimuth, sunEarthSeparation, sunEarthSkySeparation,
} from '../js/astro.js';

const DAY = 86400e3;
const T0 = Date.UTC(2026, 0, 1);
const daysOf2026 = (stepDays) => Array.from({ length: Math.floor(365 / stepDays) }, (_, i) => new Date(T0 + i * stepDays * DAY));

test('Moon-fixed axes are perpendicular unit vectors', () => {
  const f = moonFrame(new Date(T0));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const a of [f.x, f.y, f.z]) assert.ok(Math.abs(dot(a, a) - 1) < 1e-12);
  assert.ok(Math.abs(dot(f.x, f.y)) < 1e-12 && Math.abs(dot(f.x, f.z)) < 1e-12 && Math.abs(dot(f.y, f.z)) < 1e-12);
});

test('sub-Earth point agrees with the independent libration model (< 0.05°)', () => {
  let worst = 0;
  for (const d of daysOf2026(3.37)) {
    const ours = subEarthPoint(moonFrame(d));
    const lib = Astronomy.Libration(d);
    worst = Math.max(worst, Math.abs(ours.lat - lib.elat), Math.abs(ours.lon - lib.elon));
  }
  assert.ok(worst < 0.05, `worst difference ${worst.toFixed(4)}°`);
});

test('Earth is overhead at the sub-Earth point, Sun overhead at the sub-solar point', () => {
  for (const d of daysOf2026(29)) {
    const f = moonFrame(d);
    const se = subEarthPoint(f);
    const ss = subSolarPoint(f);
    assert.ok(skyAt(f, se.lat, se.lon).earth.el > 89.99);
    assert.ok(skyAt(f, ss.lat, ss.lon).sun.el > 89.99);
  }
});

test('libration limits: sub-Earth point stays within ±6.9° lat and ±8.2° lon', () => {
  let maxLat = 0, maxLon = 0;
  for (const d of daysOf2026(0.5)) {
    const p = subEarthPoint(moonFrame(d));
    maxLat = Math.max(maxLat, Math.abs(p.lat));
    maxLon = Math.max(maxLon, Math.abs(p.lon));
  }
  assert.ok(maxLat < 6.9 && maxLat > 6.0, `max latitude libration ${maxLat.toFixed(2)}°`);
  assert.ok(maxLon < 8.2 && maxLon > 6.0, `max longitude libration ${maxLon.toFixed(2)}°`);
});

test('sub-solar latitude stays within ±1.6° (the Moon has almost no seasons)', () => {
  let max = 0;
  for (const d of daysOf2026(0.5)) max = Math.max(max, Math.abs(subSolarPoint(moonFrame(d)).lat));
  assert.ok(max < 1.6 && max > 1.4, `max sub-solar latitude ${max.toFixed(3)}°`);
});

test('at the south pole the Sun hugs the horizon (|elevation| < 1.6°) and Earth stays within ±7°', () => {
  for (const d of daysOf2026(1.3)) {
    const f = moonFrame(d);
    const sky = skyAt(f, -90, 0);
    assert.ok(Math.abs(sky.sun.el) < 1.6);
    assert.ok(Math.abs(sky.earth.el) < 7.2);
    // at the pole, Sun elevation is minus the sub-solar latitude
    assert.ok(Math.abs(sky.sun.el + subSolarPoint(f).lat) < 0.01);
  }
});

test('the Sun goes once around the horizon in one synodic month (29.53 days)', () => {
  // count azimuth travel at a near-polar site over 10 synodic months
  const months = 10, synodic = 29.530589, steps = months * 200;
  let total = 0;
  let prev = skyAtTime(new Date(T0), -89, 0).sun.az;
  for (let i = 1; i <= steps; i++) {
    const az = skyAtTime(new Date(T0 + (i / steps) * months * synodic * DAY), -89, 0).sun.az;
    total += ((az - prev + 540) % 360) - 180;
    prev = az;
  }
  assert.ok(Math.abs(Math.abs(total) - months * 360) < 8, `azimuth travel ${total.toFixed(1)}°`);
});

test('phase geometry matches the library: Sun–Earth angle at the Moon = phase angle', () => {
  for (const d of daysOf2026(11)) {
    const ours = sunEarthSeparation(moonFrame(d));
    const lib = Astronomy.Illumination(Astronomy.Body.Moon, d).phase_angle;
    assert.ok(Math.abs(ours - lib) < 0.02, `${ours} vs ${lib}`);
  }
});

test('total lunar eclipse of 3 March 2026: from the Moon, Earth covers the Sun', () => {
  const ecl = Astronomy.SearchLunarEclipse(new Date(Date.UTC(2026, 1, 1)));
  assert.equal(ecl.kind, 'total');
  assert.equal(ecl.peak.date.toISOString().slice(0, 13), '2026-03-03T11');
  // seen from a near-side site, the Sun's centre must be hidden behind Earth's disc
  const sky = skyAtTime(ecl.peak.date, -85.96, -2.3);
  const sep = sunEarthSkySeparation(sky);
  assert.ok(sep < sky.earth.radius - sky.sun.radius, `separation ${sep.toFixed(3)}° vs Earth radius ${sky.earth.radius.toFixed(3)}°`);
});

test('apparent sizes: Sun ≈ 0.27° radius, Earth ≈ 0.9–1.0° radius', () => {
  const sky = skyAtTime(new Date(T0), -85, 0);
  assert.ok(sky.sun.radius > 0.25 && sky.sun.radius < 0.28);
  assert.ok(sky.earth.radius > 0.85 && sky.earth.radius < 1.05);
});

test('azimuth convention: from 85°S on the 0° meridian, Earth is roughly north', () => {
  assert.equal(meanEarthAzimuth(-85, 0), 0);
  assert.equal(Math.round(meanEarthAzimuth(-85, 90)), 270);   // from 90°E, Earth is to the west
  assert.equal(Math.round(meanEarthAzimuth(-85, 180)), 180);
  for (const d of daysOf2026(17)) {
    const az = skyAtTime(d, -85, 0).earth.az;
    assert.ok(az < 60 || az > 300, `Earth azimuth ${az.toFixed(1)}°`);
  }
});

test('discFractionVisible: 0, half, full and symmetric', () => {
  assert.equal(discFractionVisible(1, 0.27), 1);
  assert.equal(discFractionVisible(-1, 0.27), 0);
  assert.ok(Math.abs(discFractionVisible(0, 0.27) - 0.5) < 1e-12);
  assert.ok(Math.abs(discFractionVisible(0.1, 0.27) + discFractionVisible(-0.1, 0.27) - 1) < 1e-12);
});
