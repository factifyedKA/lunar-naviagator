// Small shared helpers: colours, number formatting, canvas sizing.

// Okabe–Ito colour-blind-safe palette (plus neutrals for the dark theme).
export const COLORS = {
  sun: '#F0E442',
  sunDeep: '#E69F00',
  earth: '#56B4E9',
  both: '#009E73',
  warn: '#D55E00',
  custom: '#CC79A7',
  text: '#E8EEF8',
  dim: '#9AA7BD',
  grid: 'rgba(200,215,240,0.16)',
  gridStrong: 'rgba(200,215,240,0.34)',
};

export const $ = (sel, root = document) => root.querySelector(sel);

/** Create an element: el('button', {class:'x', onclick:fn}, 'text' | [children]) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) node.append(c);
  return node;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** "85.96°S" */
export function fmtLat(lat) {
  return `${Math.abs(lat).toFixed(2)}°${lat <= 0 ? 'S' : 'N'}`;
}
/** "2.30°W" — input in degrees east, any range */
export function fmtLon(lon) {
  const l = ((lon + 540) % 360) - 180;
  return `${Math.abs(l).toFixed(2)}°${l < 0 ? 'W' : 'E'}`;
}
/** "+1.2°" with a real minus sign */
export function fmtSigned(v, digits = 1) {
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 && Number(s) !== 0 ? '−' : '+'}${s}°`;
}
/** "14 Nov 2026, 13:00 UTC" */
export function fmtDateTime(ms) {
  const d = new Date(ms);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
export function fmtDate(ms) {
  return fmtDateTime(ms).split(',')[0];
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** 23° -> "NNE" */
export function compass(az) {
  return COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * Make a canvas sharp on high-resolution screens. Returns the drawing context scaled so
 * that 1 unit = 1 CSS pixel, plus the CSS width and height.
 */
export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(50, Math.round(canvas.clientWidth));
  const h = Math.max(50, Math.round(canvas.clientHeight));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
