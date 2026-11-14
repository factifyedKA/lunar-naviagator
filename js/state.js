// One shared app state, mirrored into the URL (after the #) so any view can be shared
// by copying the link. No framework: change it with setState(), listen with subscribe().

import { SITES, CUSTOM_ID, LAT_MIN, LAT_MAX } from './sites.js';
import { DEFAULT_WEIGHTS } from './metrics.js';

const HOUR = 3600e3;
const DAY = 24 * HOUR;
export const WINDOW_DAYS = 30; // length of the time-slider window
export const RANGE_DAYS = [30, 60, 90, 180, 365]; // timeline lengths on offer
export { HOUR, DAY };

export const startOfUtcDay = (ms) => Math.floor(ms / DAY) * DAY;

export function defaultState(now = Date.now()) {
  const t = Math.round(now / HOUR) * HOUR;
  return {
    view: 'explore',
    site: 'malapert',     // selected site id, or "custom"
    lat: -89.0, lon: 45.0, // the custom point
    t,                     // current time (ms, UTC)
    t0: startOfUtcDay(t),  // start of the 30-day slider window
    hz: 0,                 // local horizon height in degrees (flat-horizon model)
    speed: 'hour',         // time-lapse speed: "hour" or "day" per second
    zoom: 0,               // map zoom level index
    hm: 'terrain',         // horizon model: "terrain" (NASA LOLA) or "flat"
    emin: 0,               // minimum Earth height above the horizon for a radio link (deg)
    rs: startOfUtcDay(t),  // timeline range: start (ms, UTC midnight)
    rd: 90,                // timeline range: length in days
    w: DEFAULT_WEIGHTS.slice(), // weights of the five score parts (0..5 each)
    // not saved in the URL:
    playing: false,
    drop: false,           // "drop a pin" mode on the map
  };
}

const num = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** State -> "v=explore&s=malapert&t=2026-11-14T13:00..." */
export function encodeState(s) {
  const p = new URLSearchParams();
  p.set('v', s.view);
  p.set('s', s.site);
  if (s.site === CUSTOM_ID) p.set('c', `${s.lat.toFixed(3)},${s.lon.toFixed(3)}`);
  p.set('t', new Date(s.t).toISOString().slice(0, 16));
  if (s.hz) p.set('hz', String(s.hz));
  if (s.speed !== 'hour') p.set('sp', s.speed);
  if (s.zoom) p.set('z', String(s.zoom));
  if (s.hm === 'flat') p.set('hm', 'flat');
  if (s.emin) p.set('em', String(s.emin));
  p.set('rs', new Date(s.rs).toISOString().slice(0, 10));
  if (s.rd !== 90) p.set('rd', String(s.rd));
  if (s.w.join() !== DEFAULT_WEIGHTS.join()) p.set('w', s.w.join(','));
  return p.toString().replace(/%3A/g, ':').replace(/%2C/g, ',');
}

/** URL text -> state. Anything missing or invalid quietly falls back to the default. */
export function decodeState(text, now = Date.now()) {
  const s = defaultState(now);
  const p = new URLSearchParams(String(text || '').replace(/^#/, ''));
  const view = p.get('v');
  if (view && /^[a-z]+$/.test(view)) s.view = view;
  const site = p.get('s');
  if (site === CUSTOM_ID || SITES.some((x) => x.id === site)) s.site = site;
  const c = (p.get('c') || '').split(',');
  if (c.length === 2) {
    s.lat = num(c[0], LAT_MIN, LAT_MAX, s.lat);
    s.lon = num(c[1], -180, 360, s.lon);
  }
  const t = Date.parse(`${p.get('t')}Z`);
  // astronomy-engine is accurate for many centuries; keep to a sensible planning range
  if (Number.isFinite(t) && t > Date.UTC(1970, 0, 1) && t < Date.UTC(2100, 0, 1)) {
    s.t = t;
    s.t0 = startOfUtcDay(t);
  }
  s.hz = num(p.get('hz'), -3, 5, 0);
  if (p.get('sp') === 'day') s.speed = 'day';
  s.zoom = Math.round(num(p.get('z'), 0, 2, 0));
  if (p.get('hm') === 'flat') s.hm = 'flat';
  s.emin = Math.round(num(p.get('em'), 0, 10, 0) * 2) / 2;
  const rs = Date.parse(`${p.get('rs')}T00:00Z`);
  if (Number.isFinite(rs) && rs > Date.UTC(1970, 0, 2) && rs < Date.UTC(2099, 0, 1)) s.rs = rs;
  if (RANGE_DAYS.includes(Number(p.get('rd')))) s.rd = Number(p.get('rd'));
  const w = (p.get('w') || '').split(',').map(Number);
  if (w.length === DEFAULT_WEIGHTS.length && w.every((x) => Number.isInteger(x) && x >= 0 && x <= 5)) s.w = w;
  return s;
}

// ---- tiny store ---------------------------------------------------------------------
let state = defaultState();
const listeners = new Set();
let urlTimer = null;

export const getState = () => state;
export function subscribe(fn) { listeners.add(fn); }

export function setState(patch) {
  const next = { ...state, ...patch };
  // keep the current time inside the slider window
  if (next.t < next.t0 || next.t > next.t0 + WINDOW_DAYS * DAY) next.t0 = startOfUtcDay(next.t);
  const prev = state;
  state = next;
  listeners.forEach((fn) => fn(state, prev));
  scheduleUrlUpdate();
}

function scheduleUrlUpdate() {
  if (typeof window === 'undefined' || state.playing) return; // do not spam the URL while animating
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    try { history.replaceState(null, '', `#${encodeState(state)}`); } catch { /* ignore */ }
  }, 350);
}

/** Read the URL once at start-up and whenever the user edits it or uses back/forward. */
export function initStateFromUrl() {
  state = decodeState(window.location.hash);
  window.addEventListener('hashchange', () => {
    const fromUrl = decodeState(window.location.hash);
    if (encodeState(fromUrl) !== encodeState(state)) setState({ ...fromUrl, playing: false, drop: false });
  });
  return state;
}
