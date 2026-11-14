// Starts the app and connects the controls to the views.

import { SITES, GROUPS, CUSTOM_ID, LAT_MIN, LAT_MAX, getSite } from './sites.js';
import { getState, setState, subscribe, initStateFromUrl } from './state.js';
import { createMap, ZOOMS } from './map.js';
import { $, el, clamp, fmtLat, fmtLon } from './ui.js';

const VIEWS = [
  { id: 'explore', label: 'Explore' },
  { id: 'about', label: 'About' },
];

let map;
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
  window.addEventListener('resize', requestRender);
  if ('ResizeObserver' in window) new ResizeObserver(requestRender).observe($('#map'));
}

function placeCustom(lat, lon) {
  const okLat = clamp(lat, LAT_MIN, LAT_MAX);
  if (okLat !== lat) toast('Latitude was moved into the 80°S–90°S map area.');
  setState({ site: CUSTOM_ID, lat: Math.round(okLat * 1000) / 1000, lon: Math.round((((lon + 540) % 360) - 180) * 1000) / 1000, drop: false });
}

// ---------- drawing ----------
function requestRender() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => { frameRequested = false; render(); });
}

function render() {
  const s = getState();
  const site = getSite(s.site, s.lat, s.lon);

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

  // custom-point controls
  $('#drop-btn').setAttribute('aria-pressed', String(s.drop));
  $('#drop-btn').textContent = s.drop ? 'Now tap the map…' : 'Drop a pin on the map';
  $('#map').classList.toggle('dropping', s.drop);
  if (document.activeElement !== $('#custom-lat')) $('#custom-lat').value = hasCustom ? s.lat : '';
  if (document.activeElement !== $('#custom-lon')) $('#custom-lon').value = hasCustom ? s.lon : '';

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
      ' NASA defines this as a region about 15 km across; the marker is near its centre.');
  } else if (site.group !== 'custom') {
    approx.append(el('span', { class: 'badge ok', text: 'Exact position' }));
  }

  if (view !== 'explore') return;

  // map
  $('#zoom-in').disabled = s.zoom >= ZOOMS.length - 1;
  $('#zoom-out').disabled = s.zoom <= 0;
  map.draw({ zoom: s.zoom, site: s.site, custom: hasCustom ? { lat: s.lat, lon: s.lon } : null, drop: s.drop, light: null });
  const edge = Math.abs(ZOOMS[s.zoom]);
  $('#map-caption').textContent = `Polar map from ${edge}°S to the pole; the side facing Earth is at the top. `
    + 'Grey rings are named craters (schematic outlines, not a photo).';
  $('#map').setAttribute('aria-label', `Map of the Moon's south pole. Selected site: ${site.name} at ${fmtLat(site.lat)}, ${fmtLon(site.lon)}.`);
}

// ---------- start ----------
function start() {
  const s = initStateFromUrl();
  hasCustom = s.site === CUSTOM_ID;
  buildTabs();
  buildSiteList();
  map = createMap($('#map'), {
    onSelect: (id) => setState({ site: id }),
    onDrop: (lat, lon) => placeCustom(lat, lon),
  });
  wireControls();
  subscribe(requestRender);
  render();
}

start();
