// Starts the app and connects the controls to the views.

import { SITES, GROUPS, CUSTOM_ID, LAT_MIN, LAT_MAX, getSite } from './sites.js';
import { getState, setState, subscribe, initStateFromUrl, currentUrl, HOUR, DAY, WINDOW_DAYS } from './state.js';
import { moonFrame, skyAt, subEarthPoint, subSolarPoint, meanEarthAzimuth } from './astro.js';
import { visibility } from './metrics.js';
import { data, loadData, siteModel, horizonNote } from './model.js';
import { initTimelineView, renderTimelineView } from './timeline-view.js';
import { initCompareView, renderCompareView } from './compare-view.js';
import { initFinderView, renderFinderView } from './finder-view.js';
import { initLearnView, renderLearnView } from './learn-view.js';
import { glossarize, initGlossaryTooltips } from './glossary.js';
import { downloadPng, shareLink, slug } from './export.js';
import { createMap, ZOOMS } from './map.js';
import { createSky } from './horizon.js';
import { $, el, clamp, fmtLat, fmtLon, fmtSigned, fmtDateTime, fmtDate, compass } from './ui.js';

const VIEWS = [
  { id: 'explore', label: 'Explore' },
  { id: 'timeline', label: 'Timeline & scores' },
  { id: 'compare', label: 'Compare' },
  { id: 'finder', label: 'Best window' },
  { id: 'learn', label: 'Learn' },
  { id: 'about', label: 'About' },
];
const MINUTE = 60e3;

let map;
let sky;
let hasCustom = false; // becomes true once the user has placed a custom point
let frameRequested = false;

// ---------- friendly error handling: never show a raw error to the user ----------
function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 5000);
}
window.addEventListener('error', () => toast('Something went wrong. Please reload the page.'));
window.addEventListener('unhandledrejection', () => toast('Something went wrong. Please reload the page.'));

// ---------- build the static parts of the page ----------
function buildTabs() {
  const nav = $('#tabs');
  for (const v of VIEWS) {
    nav.append(el('button', { type: 'button', class: 'tab', 'data-view': v.id, text: v.label,
      onclick: () => setState({ view: v.id, playing: false }) }));
  }
}

function siteButton(s) {
  return el('li', {}, el('button', { type: 'button', class: 'site-btn', 'data-site': s.id, 'aria-pressed': 'false',
    onclick: () => setState({ site: s.id, drop: false }) }, [
    el('span', { class: `site-num ${s.group}`, 'aria-hidden': 'true', text: String(s.n) }),
    el('span', {}, [
      el('span', { class: 'name', text: s.name }),
      el('br'),
      el('span', { class: 'sub', text: `${fmtLat(s.lat)}, ${fmtLon(s.lon)}${s.approx ? ' · approx.' : ''}` }),
    ]),
  ]));
}

function buildSiteList() {
  const box = $('#site-list');
  box.textContent = '';
  for (const g of GROUPS) {
    box.append(el('p', { class: 'group-title' }, [g.title, el('small', { text: g.note })]));
    box.append(el('ul', { class: 'site-list' }, SITES.filter((s) => s.group === g.id).map(siteButton)));
  }
  if (hasCustom) {
    const s = getState();
    box.append(el('p', { class: 'group-title', text: 'Your point' }));
    box.append(el('ul', { class: 'site-list' }, siteButton(getSite(CUSTOM_ID, s.lat, s.lon))));
  }
}

function wireControls() {
  $('#zoom-in').addEventListener('click', () => setState({ zoom: clamp(getState().zoom + 1, 0, ZOOMS.length - 1) }));
  $('#zoom-out').addEventListener('click', () => setState({ zoom: clamp(getState().zoom - 1, 0, ZOOMS.length - 1) }));
  $('#drop-btn').addEventListener('click', () => setState({ drop: !getState().drop, view: 'explore' }));
  $('#custom-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const lat = Number($('#custom-lat').value);
    const lon = Number($('#custom-lon').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || $('#custom-lat').value === '' || $('#custom-lon').value === '') {
      toast('Please type a latitude and a longitude first.');
      return;
    }
    placeCustom(lat, lon);
  });
  $('#hz').addEventListener('input', (ev) => setState({ hz: Number(ev.target.value) }));
  $('#mode-simple').addEventListener('click', () => setState({ mode: 'simple' }));
  $('#mode-expert').addEventListener('click', () => setState({ mode: 'expert' }));
  $('#share-btn').addEventListener('click', () => shareLink(currentUrl(), toast));
  $('#map-png').addEventListener('click', () => {
    const s = getState();
    const site = getSite(s.site, s.lat, s.lon);
    downloadPng(`moon-south-pole-map-${slug(site.name)}.png`, `South-pole site map · ${site.name} · ${fmtDateTime(s.t)}`,
      [{ canvas: $('#map') }], 'Arrows: direction of the Sun and the Earth.');
  });
  $('#sky-png').addEventListener('click', () => {
    const s = getState();
    const site = getSite(s.site, s.lat, s.lon);
    downloadPng(`horizon-view-${slug(site.name)}.png`, `Horizon view from ${site.name} · ${fmtDateTime(s.t)}`,
      [{ canvas: $('#sky') }], `${$('#sun-line').textContent}; ${$('#earth-line').textContent}.`);
  });
  $('#hm-terrain').addEventListener('click', () => setState({ hm: 'terrain' }));
  $('#hm-flat').addEventListener('click', () => setState({ hm: 'flat' }));
  $('#emin').addEventListener('input', (ev) => setState({ emin: Number(ev.target.value) }));

  // time controls
  $('#play').addEventListener('click', () => setPlaying(!getState().playing));
  $('#step-back').addEventListener('click', () => setState({ t: getState().t - DAY, playing: false }));
  $('#step-fwd').addEventListener('click', () => setState({ t: getState().t + DAY, playing: false }));
  $('#speed-hour').addEventListener('click', () => setState({ speed: 'hour' }));
  $('#speed-day').addEventListener('click', () => setState({ speed: 'day' }));
  $('#now-btn').addEventListener('click', () => setState({ t: Math.round(Date.now() / MINUTE) * MINUTE, playing: false }));
  $('#time-slider').addEventListener('input', (ev) => {
    setState({ t: getState().t0 + Number(ev.target.value) * HOUR, playing: false });
  });
  $('#time-input').addEventListener('change', (ev) => {
    const t = Date.parse(`${ev.target.value}Z`);
    if (Number.isFinite(t) && t > Date.UTC(1970, 0, 2) && t < Date.UTC(2100, 0, 1)) setState({ t, playing: false });
    else requestRender(); // put the old value back
  });

  window.addEventListener('resize', requestRender);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(requestRender);
    ro.observe($('#map'));
    ro.observe($('#sky'));
    ro.observe($('#main'));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
}

function placeCustom(lat, lon) {
  const okLat = clamp(lat, LAT_MIN, LAT_MAX);
  if (okLat !== lat) toast('Latitude was moved into the 80°S–90°S map area.');
  setState({ site: CUSTOM_ID, lat: Math.round(okLat * 1000) / 1000, lon: Math.round((((lon + 540) % 360) - 180) * 1000) / 1000, drop: false });
}

// ---------- time-lapse ----------
let playClock = 0;   // exact time while playing (the state keeps whole minutes)
let lastTick = 0;
function setPlaying(on) {
  if (on === getState().playing) return;
  playClock = getState().t;
  lastTick = 0;
  setState({ playing: on });
  if (on) requestAnimationFrame(tick);
}
function tick(now) {
  const s = getState();
  if (!s.playing) return;
  const dt = lastTick ? Math.min(now - lastTick, 100) : 0; // ms of real time, capped after a pause
  lastTick = now;
  playClock += (dt / 1000) * (s.speed === 'day' ? DAY : HOUR);
  if (playClock > Date.UTC(2099, 11, 1)) { setPlaying(false); return; }
  setState({ t: Math.round(playClock / MINUTE) * MINUTE });
  requestAnimationFrame(tick);
}

// ---------- Sun/Earth paths over the slider window (cached) ----------
const trailCache = { framesKey: null, frames: [], siteKey: null, trail: null };
function getTrail(t0, lat, lon, heightKm) {
  if (trailCache.framesKey !== t0) {
    trailCache.frames = [];
    for (let h = 0; h <= WINDOW_DAYS * 24; h++) trailCache.frames.push(moonFrame(t0 + h * HOUR));
    trailCache.framesKey = t0;
    trailCache.siteKey = null;
  }
  const key = `${t0}|${lat}|${lon}|${heightKm}`;
  if (trailCache.siteKey !== key) {
    const sun = [];
    const earth = [];
    for (const f of trailCache.frames) {
      const p = skyAt(f, lat, lon, heightKm);
      sun.push([p.sun.az, p.sun.el]);
      earth.push([p.earth.az, p.earth.el]);
    }
    trailCache.trail = { sun, earth };
    trailCache.siteKey = key;
  }
  return trailCache.trail;
}

// ---------- words for the read-outs ----------
const aboveBelow = (name, rel) => `${name} is ${Math.abs(rel).toFixed(1)}° ${rel >= 0 ? 'above' : 'below'} the horizon`;
const direction = (b) => `Direction ${compass(b.az)} · azimuth ${b.az.toFixed(0)}° · elevation ${fmtSigned(b.el, 2)}`;
function setChip(node, kind, text) {
  node.className = `chip ${kind}`;
  node.textContent = text;
}

// ---------- drawing ----------
function requestRender() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => { frameRequested = false; render(); glossarizeCaptions(); });
}

/** Adds glossary tooltips to chart captions whose text has changed (skipped during time-lapse). */
function glossarizeCaptions() {
  if (getState().playing) return;
  for (const node of document.querySelectorAll('.view:not([hidden]) .caption')) {
    if (node.dataset.seen === node.textContent) continue;
    glossarize(node);
    node.dataset.seen = node.textContent;
  }
}

function render() {
  const s = getState();
  const site = getSite(s.site, s.lat, s.lon);

  document.body.classList.toggle('mode-simple', s.mode !== 'expert');
  $('#mode-simple').setAttribute('aria-pressed', String(s.mode !== 'expert'));
  $('#mode-expert').setAttribute('aria-pressed', String(s.mode === 'expert'));

  // tabs and views
  const view = VIEWS.some((v) => v.id === s.view) ? s.view : 'explore';
  for (const v of VIEWS) {
    $(`#view-${v.id}`).hidden = v.id !== view;
    const tab = $(`.tab[data-view="${v.id}"]`);
    if (v.id === view) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  }

  // site list
  if (s.site === CUSTOM_ID && !hasCustom) { hasCustom = true; buildSiteList(); }
  for (const b of document.querySelectorAll('.site-btn')) b.setAttribute('aria-pressed', String(b.dataset.site === s.site));
  const customSub = $(`.site-btn[data-site="${CUSTOM_ID}"] .sub`);
  if (customSub) customSub.textContent = `${fmtLat(s.lat)}, ${fmtLon(s.lon)}`;

  // panel controls
  $('#drop-btn').setAttribute('aria-pressed', String(s.drop));
  $('#drop-btn').textContent = s.drop ? 'Now tap the map…' : 'Drop a pin on the map';
  $('#map').classList.toggle('dropping', s.drop);
  if (document.activeElement !== $('#custom-lat')) $('#custom-lat').value = hasCustom ? s.lat : '';
  if (document.activeElement !== $('#custom-lon')) $('#custom-lon').value = hasCustom ? s.lon : '';
  $('#hz').value = s.hz;
  $('#hz-out').textContent = fmtSigned(s.hz);
  $('#hm-terrain').setAttribute('aria-pressed', String(s.hm !== 'flat'));
  $('#hm-flat').setAttribute('aria-pressed', String(s.hm === 'flat'));
  $('#hz-box').hidden = s.hm !== 'flat';
  $('#emin').value = s.emin;
  $('#emin-out').textContent = `${s.emin}°`;
  const model = siteModel(s, site, requestRender);
  $('#hm-note').textContent = horizonNote(model);

  // site card
  $('#site-group').textContent = site.group === 'custom' ? 'Your point'
    : GROUPS.find((g) => g.id === site.group).title;
  $('#site-name').textContent = `${site.n} · ${site.name}`;
  $('#site-coords').textContent = `${fmtLat(site.lat)}, ${fmtLon(site.lon)}`;
  $('#site-blurb').textContent = site.blurb;
  const approx = $('#site-approx');
  approx.textContent = '';
  if (site.approx) {
    approx.append(el('span', { class: 'badge', text: 'Approximate position' }),
      site.group === 'reference' ? ' A reference point from published lunar-pole studies; treat its coordinates as approximate.'
        : ' NASA defines this as a region about 15 km across; the marker is near its centre.');
  } else if (site.group !== 'custom') {
    approx.append(el('span', { class: 'badge ok', text: 'Exact position' }));
  }

  // where the terrain calculation actually stands
  $('#site-terrain').textContent = model.kind !== 'terrain' ? ''
    : `Terrain viewpoint: ${fmtLat(model.lat)}, ${fmtLon(model.lon)}, ${Math.round(model.heightM).toLocaleString('en-US')} m above the Moon's mean radius`
      + (site.snapKm ? ` — the highest ground within ${site.snapKm} km of the marker, plus a 2 m mast.` : ', plus a 2 m mast.');

  if (view === 'timeline') { renderTimelineView(); return; }
  if (view === 'compare') { renderCompareView(); return; }
  if (view === 'finder') { renderFinderView(); return; }
  if (view === 'learn') { renderLearnView(); return; }
  if (view !== 'explore') return;

  // ---- the science: where are the Sun and the Earth right now? ----
  const frame = moonFrame(s.t);
  const now = skyAt(frame, model.lat, model.lon, model.heightKm);
  const vis = visibility(now, model, s.emin);
  const sunRel = vis.sunH;                // height above the local horizon
  const earthRel = vis.earthH;
  const sunFrac = vis.sunFrac;

  // read-outs
  $('#now-time').textContent = fmtDateTime(s.t);
  $('#sun-line').textContent = aboveBelow('Sun', sunRel);
  $('#sun-sub').textContent = direction(now.sun);
  if (vis.eclipse) setChip($('#sun-chip'), 'part', '◐ Eclipse — the Earth is covering the Sun, little or no solar power');
  else if (sunFrac >= 0.999) setChip($('#sun-chip'), 'on', '✔ Full Sun — solar power available');
  else if (sunFrac > 0.001) setChip($('#sun-chip'), 'part', `◐ Sun partly hidden — ${Math.round(sunFrac * 100)}% of its disc shows`);
  else setChip($('#sun-chip'), 'off', '✖ Sun hidden — no solar power');
  $('#earth-line').textContent = aboveBelow('Earth', earthRel);
  $('#earth-sub').textContent = direction(now.earth);
  if (vis.earthUp) setChip($('#earth-chip'), 'on', '✔ Earth in view — direct radio link possible');
  else if (earthRel >= 0) setChip($('#earth-chip'), 'part', `◐ Earth is up, but below your ${s.emin}° margin — no reliable link`);
  else setChip($('#earth-chip'), 'off', '✖ Earth hidden — no direct radio link');

  // map
  $('#zoom-in').disabled = s.zoom >= ZOOMS.length - 1;
  $('#zoom-out').disabled = s.zoom <= 0;
  const subSun = subSolarPoint(frame);
  map.draw({
    zoom: s.zoom, site: s.site, custom: hasCustom ? { lat: s.lat, lon: s.lon } : null, drop: s.drop,
    light: { sunLon: subSun.lon, sunLat: subSun.lat, earthLon: subEarthPoint(frame).lon }, relief: data.relief,
  });
  const edge = Math.abs(ZOOMS[s.zoom]);
  $('#map-caption').textContent = `Polar map from ${edge}°S to the pole; the side facing Earth is at the top. `
    + 'Arrows on the rim point towards the Sun and the Earth right now; the darker half is night on a smooth Moon '
    + '(real terrain shadows are not shown). '
    + (data.relief ? 'Background: shaded relief made from NASA LRO/LOLA elevation data, with artificial lighting.'
      : 'Grey rings are named craters (schematic outlines, not a photo).');

  // horizon view
  $('#sky-site').textContent = site.name;
  const { stretch } = sky.draw({
    lat: model.lat, hz: model.hz, mask: model.mask, centerAz: meanEarthAzimuth(model.lat, model.lon),
    sun: now.sun, earth: now.earth, trail: getTrail(s.t0, model.lat, model.lon, model.heightKm),
  });
  $('#sky-caption').textContent = `Full 360° view of the horizon from ${site.name} at ${fmtDateTime(s.t)}. `
    + `Heights are stretched about ${Math.max(1, Math.round(stretch))}× so small angles are easy to see. `
    + `Dotted lines: path of the Sun (yellow) and the Earth (blue) from ${fmtDate(s.t0)} to ${fmtDate(s.t0 + WINDOW_DAYS * DAY)}. `
    + horizonNote(model);

  // time controls
  $('#play').textContent = s.playing ? '❚❚ Pause' : '▶ Play';
  $('#play').setAttribute('aria-pressed', String(s.playing));
  $('#speed-hour').setAttribute('aria-pressed', String(s.speed === 'hour'));
  $('#speed-day').setAttribute('aria-pressed', String(s.speed === 'day'));
  if (document.activeElement !== $('#time-input')) $('#time-input').value = new Date(s.t).toISOString().slice(0, 16);
  $('#time-slider').value = String(Math.round((s.t - s.t0) / HOUR));
  $('#time-slider').setAttribute('aria-valuetext', fmtDateTime(s.t));
  $('#win-start').textContent = fmtDate(s.t0);
  $('#win-end').textContent = fmtDate(s.t0 + WINDOW_DAYS * DAY);

  if (!s.playing) { // describe the pictures for screen readers (not on every animation frame)
    const summary = `${aboveBelow('Sun', sunRel)}, ${aboveBelow('Earth', earthRel)}`;
    $('#map').setAttribute('aria-label', `Map of the Moon's south pole. Selected site: ${site.name} at ${fmtLat(site.lat)}, ${fmtLon(site.lon)}.`);
    $('#sky').setAttribute('aria-label', `Horizon view from ${site.name} at ${fmtDateTime(s.t)}: ${summary}.`);
  }
}

// ---------- start ----------
async function start() {
  const s = initStateFromUrl();
  hasCustom = s.site === CUSTOM_ID;
  buildTabs();
  buildSiteList();
  map = createMap($('#map'), {
    onSelect: (id) => setState({ site: id }),
    onDrop: (lat, lon) => placeCustom(lat, lon),
  });
  sky = createSky($('#sky'));
  wireControls();
  initTimelineView(requestRender);
  initCompareView(requestRender);
  initFinderView(requestRender);
  initLearnView(requestRender, { play: () => setPlaying(true), glossarize });
  initGlossaryTooltips();
  for (const node of document.querySelectorAll('.hint p, .prose p, .prose li, .note')) glossarize(node);
  subscribe(requestRender);
  render();                                   // show the page at once…
  const ok = await loadData(requestRender);   // …then add terrain and pre-computed results
  if (!ok) toast('Terrain data could not be loaded, so a flat horizon is used.');
  requestRender();
}

start();
