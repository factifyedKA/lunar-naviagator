// "Validation" view: automated checks that run in the browser every time the page is
// opened, comparing this tool with NASA reference values and with known physics.

import * as Astronomy from '../vendor/astronomy.js';
import { SITES } from './sites.js';
import { moonFrame, skyAt, skyAtTime, subEarthPoint, subSolarPoint, sunEarthSkySeparation } from './astro.js';
import { summarize } from './metrics.js';
import { seriesJob, maskJob } from './compute.js';
import { data } from './model.js';
import { $, el } from './ui.js';

const DAY = 86400e3;
let started = false;
const results = []; // { group, name, detail, pass }
const TOL_HORIZONS = 0.05;   // degrees
const TOL_NASA = 10;         // percentage points
const EARTH_ANY_PART = -0.95; // Earth's centre may be this far below the horizon while its limb still shows

const getJson = async (name) => {
  const r = await fetch(new URL(`../data/${name}`, import.meta.url));
  if (!r.ok) throw new Error(`${name} missing`);
  return r.json();
};
const f = (v, d = 3) => v.toFixed(d);

function add(group, name, detail, pass) { results.push({ group, name, detail, pass }); }

// ---- 1. astronomy against NASA JPL Horizons ------------------------------------------
async function checkHorizons() {
  const ref = await getJson('validation-horizons.json');
  const groups = new Map();
  const body = $('#val-horizons tbody');
  for (const r of ref.rows) {
    const ours = skyAtTime(new Date(r.time), r.lat, r.lon)[r.body.toLowerCase()];
    const dAz = Math.abs(((ours.az - r.az + 540) % 360) - 180) * Math.cos(r.el * Math.PI / 180); // difference on the sky
    const dEl = Math.abs(ours.el - r.el);
    const key = `${r.point} — ${r.body}`;
    const g = groups.get(key) || { n: 0, az: 0, el: 0 };
    g.n++; g.az = Math.max(g.az, dAz); g.el = Math.max(g.el, dEl);
    groups.set(key, g);
    body.append(el('tr', {}, [
      el('th', { scope: 'row', text: r.point.replace(' marker', '') }), el('td', { text: r.body }), el('td', { text: r.time.slice(0, 10) }),
      el('td', { text: f(r.az) }), el('td', { text: f(ours.az) }), el('td', { text: f(r.el) }), el('td', { text: f(ours.el) }),
      el('td', { text: Math.max(dAz, dEl) < TOL_HORIZONS ? '✔ pass' : '✖ fail' }),
    ]));
  }
  for (const [key, g] of groups) {
    add('Sun and Earth positions vs NASA JPL Horizons', key,
      `${g.n} dates, 2026–2028: largest difference ${f(g.az)}° in azimuth, ${f(g.el)}° in elevation (limit ${TOL_HORIZONS}°)`,
      g.az < TOL_HORIZONS && g.el < TOL_HORIZONS);
  }
  $('#val-horizons-note').textContent = `Reference: ${ref.source}; ${ref.settings}. Retrieved ${ref.retrieved}. `
    + `Horizons uses the Moon frame “${ref.moonFrameReportedByHorizons.replace(/\s+/g, ' ')}”. Azimuth differences are scaled to true angle on the sky.`;
}

// ---- 2. physics that must hold -------------------------------------------------------
function checkPhysics() {
  const G = 'Known physics';
  const t0 = Date.UTC(2026, 10, 1);
  let lib = 0, maxLat = 0, maxLon = 0, maxSun = 0, maxPoleSun = 0;
  for (let i = 0; i < 2 * 365 * 4; i++) {            // two years, every 6 hours
    const d = new Date(t0 + i * DAY / 4);
    const frame = moonFrame(d);
    const se = subEarthPoint(frame);
    if (i % 8 === 0) { const l = Astronomy.Libration(d); lib = Math.max(lib, Math.abs(se.lat - l.elat), Math.abs(se.lon - l.elon)); }
    maxLat = Math.max(maxLat, Math.abs(se.lat));
    maxLon = Math.max(maxLon, Math.abs(se.lon));
    maxSun = Math.max(maxSun, Math.abs(subSolarPoint(frame).lat));
    maxPoleSun = Math.max(maxPoleSun, Math.abs(skyAt(frame, -90, 0).sun.el));
  }
  add(G, 'Moon orientation agrees with an independent libration model',
    `largest difference between our IAU-based sub-Earth point and the library’s separate libration routine: ${f(lib)}° (limit 0.05°)`, lib < 0.05);
  add(G, 'Libration stays inside its known limits',
    `Earth wanders at most ${f(maxLat, 2)}° in latitude and ${f(maxLon, 2)}° in longitude (known limits about 6.9° and 8.2°)`, maxLat < 6.9 && maxLon < 8.2 && maxLat > 6);
  add(G, 'The Moon has almost no seasons',
    `the Sun’s overhead point stays within ${f(maxSun, 2)}° of the lunar equator (expected about 1.5°)`, maxSun > 1.4 && maxSun < 1.6);
  add(G, 'At the south pole the Sun hugs the horizon',
    `on a smooth Moon the Sun is never more than ${f(maxPoleSun, 2)}° above or below the horizon at the pole (limit 1.6°)`, maxPoleSun < 1.6);

  // one trip of the Sun around the horizon = one synodic month
  const months = 12, synodic = 29.530589, steps = months * 120;
  let turn = 0;
  let prev = skyAtTime(new Date(t0), -89, 0).sun.az;
  for (let i = 1; i <= steps; i++) {
    const az = skyAtTime(new Date(t0 + (i / steps) * months * synodic * DAY), -89, 0).sun.az;
    turn += ((az - prev + 540) % 360) - 180;
    prev = az;
  }
  const period = (months * synodic) / (Math.abs(turn) / 360);
  add(G, 'The Sun circles the horizon once per lunar day', `measured ${f(period, 2)} days per circuit (true synodic month 29.53 days)`, Math.abs(period - synodic) < 0.15);

  // a real event: total lunar eclipse of 3 March 2026
  const ecl = Astronomy.SearchLunarEclipse(new Date(Date.UTC(2026, 1, 1)));
  const sky = skyAtTime(ecl.peak.date, -85.96, -2.3);
  const sep = sunEarthSkySeparation(sky);
  add(G, 'Total lunar eclipse of 3 March 2026',
    `at mid-eclipse (${ecl.peak.date.toISOString().slice(11, 16)} UTC) the Sun is ${f(sep, 2)}° from the Earth’s centre in the lunar sky, inside the Earth’s ${f(sky.earth.radius, 2)}° disc — the Earth hides the Sun`,
    ecl.kind === 'total' && sep < sky.earth.radius - sky.sun.radius);
}

// ---- 3. terrain results against NASA's LOLA illumination maps -------------------------
async function checkTerrain() {
  const G = 'Terrain results vs NASA LOLA illumination maps';
  const ref = await getJson('validation-nasa-illumination.json');
  if (!data.horizons) throw new Error('terrain data not loaded');
  const start = Date.UTC(2027, 0, 1);
  const sites = SITES.filter((s) => s.id !== 'pole'); // the exact pole falls between map pixels
  const models = sites.map((s) => { const h = data.horizons.sites[s.id]; return { lat: h.lat, lon: h.lon, heightKm: h.height / 1000, mask: h.mask }; });
  const series = await seriesJob(models, start, 8760, EARTH_ANY_PART);
  const body = $('#val-terrain tbody');
  let worstSun = 0, worstEarth = 0;
  sites.forEach((s, i) => {
    const ours = summarize(series[i]);
    const n = ref.sites[s.id];
    const dSun = ours.sunlitPct - n.sunPct;
    const dEarth = ours.earthPct - n.earthPct;
    worstSun = Math.max(worstSun, Math.abs(dSun));
    worstEarth = Math.max(worstEarth, Math.abs(dEarth));
    const ok = Math.abs(dSun) <= TOL_NASA && Math.abs(dEarth) <= TOL_NASA;
    body.append(el('tr', {}, [
      el('th', { scope: 'row', text: s.name }),
      el('td', { text: `${f(n.sunPct, 1)}%` }), el('td', { text: `${f(ours.sunlitPct, 1)}%` }), el('td', { text: `${dSun >= 0 ? '+' : '−'}${f(Math.abs(dSun), 1)}` }),
      el('td', { text: `${f(n.earthPct, 1)}%` }), el('td', { text: `${f(ours.earthPct, 1)}%` }), el('td', { text: `${dEarth >= 0 ? '+' : '−'}${f(Math.abs(dEarth), 1)}` }),
      el('td', { text: ok ? '✔ pass' : '✖ fail' }),
    ]));
  });
  add(G, 'Average sunlight at 12 site viewpoints', `largest difference from NASA’s 18.6-year map: ${f(worstSun, 1)} percentage points (limit ${TOL_NASA})`, worstSun <= TOL_NASA);
  add(G, 'Earth visibility at 12 site viewpoints', `largest difference from NASA’s 18.6-year map: ${f(worstEarth, 1)} percentage points (limit ${TOL_NASA})`, worstEarth <= TOL_NASA);
  $('#val-terrain-note').textContent = `Reference: ${ref.source}; ${ref.method}. Retrieved ${ref.retrieved}. `
    + 'Ours: the year 2027 in hourly steps, observer 2 m above the same map pixel, Earth counted visible while any part of its disc shows (to match NASA’s definition). '
    + `Differences of a few points are expected (one year against 18.6 years, 2 m mast against the bare surface); the limit is ${TOL_NASA} points. `
    + 'The exact South Pole is left out because it falls on the corner between four map pixels.';

  // permanently shadowed crater floors
  const floors = Object.entries(ref.craterFloors);
  const masks = await Promise.all(floors.map(([, p]) => maskJob(p.lat, p.lon)));
  const fs = await seriesJob(floors.map(([, p], i) => ({ lat: p.lat, lon: p.lon, heightKm: masks[i].height / 1000, mask: masks[i].mask })), start, 8760, 0);
  floors.forEach(([name, p], i) => {
    const ours = summarize(fs[i]).sunlitPct;
    add('Permanently shadowed regions', name, `NASA map: ${f(p.sunPct, 1)}% (permanent shadow). Ours for 2027: ${f(ours, 1)}% sunlit`, p.sunPct === 0 && ours < 0.05);
  });
}

function show() {
  const list = $('#val-list');
  list.textContent = '';
  let group = '';
  for (const r of results) {
    if (r.group !== group) { group = r.group; list.append(el('h4', { text: group })); }
    list.append(el('div', { class: `check ${r.pass ? 'pass' : 'fail'}` }, [
      el('span', { class: 'check-mark', text: r.pass ? '✔ Pass' : '✖ Fail' }),
      el('div', {}, [el('strong', { text: r.name }), el('br'), el('span', { class: 'note-inline', text: r.detail })]),
    ]));
  }
  const failed = results.filter((r) => !r.pass).length;
  const sum = $('#val-summary');
  sum.className = `val-summary ${failed ? 'fail' : 'pass'}`;
  sum.textContent = failed ? `${results.length - failed} of ${results.length} checks passed, ${failed} failed.` : `All ${results.length} checks passed.`;
}

export async function renderValidationView() {
  if (started) return;
  if (!data.horizons) return; // wait until the terrain data has loaded (the app re-renders then)
  started = true;
  $('#val-summary').textContent = 'Running the checks…';
  const steps = [['NASA JPL Horizons comparison', checkHorizons], ['Physics checks', async () => checkPhysics()], ['NASA illumination map comparison', checkTerrain]];
  for (const [name, fn] of steps) {
    try { await fn(); } catch { add('Checks that could not run', name, 'The reference data for this check could not be loaded.', false); }
    show();
  }
}
