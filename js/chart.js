// Timeline chart: when is the Sun in view (power), when is the Earth in view (direct
// radio link), and when both — drawn as three coloured strips, with optional curves of
// the Sun's and Earth's height above the local horizon on top.

import { COLORS, fitCanvas, fmtSigned } from './ui.js';

const DAY = 86400e3;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAD = { left: 64, right: 14, top: 10, bottom: 30 };
const STRIP_H = 24;
const STRIP_GAP = 6;
export const STRIPS = [
  { key: 'sun', label: 'Sun', color: COLORS.sun },
  { key: 'earth', label: 'Earth', color: COLORS.earth },
  { key: 'both', label: 'Both', color: COLORS.both },
];

/** Height in CSS pixels the chart needs. */
export function timelineHeight(withCurves) {
  return PAD.top + (withCurves ? 170 : 0) + STRIPS.length * (STRIP_H + STRIP_GAP) + PAD.bottom;
}

/**
 * drawTimeline(canvas, { series, startMs, stepHours, curves, cursor })
 *   series  { sunFrac, earthUp, sunH, earthH } from computeSeries()
 *   curves  true to draw the elevation curves above the strips
 *   cursor  optional sample index to highlight
 * Returns { indexAt(clientX) } to turn a tap position into a sample index.
 */
export function drawTimeline(canvas, { series, startMs, stepHours = 1, curves = true, cursor = null }) {
  const { ctx, w, h } = fitCanvas(canvas);
  const n = series.sunFrac.length;
  const plotW = w - PAD.left - PAD.right;
  const X = (i) => PAD.left + (i / (n - 1)) * plotW;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '12px system-ui, sans-serif';

  const stripsTop = PAD.top + (curves ? 170 : 0);
  const bottom = stripsTop + STRIPS.length * (STRIP_H + STRIP_GAP) - STRIP_GAP;

  // ---- date grid ----
  const spanDays = ((n - 1) * stepHours) / 24;
  const ticks = dateTicks(startMs, spanDays);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const t of ticks) {
    const x = PAD.left + ((t.ms - startMs) / (spanDays * DAY)) * plotW;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, bottom + 4); ctx.stroke();
    ctx.fillStyle = COLORS.dim;
    if (x > PAD.left + 16 && x < w - PAD.right - 16) ctx.fillText(t.label, x, bottom + 8);
  }

  // ---- elevation curves ----
  if (curves) {
    const top = PAD.top;
    const ch = 156;
    let lo = -2, hi = 2;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, series.sunH[i], series.earthH[i]);
      hi = Math.max(hi, series.sunH[i], series.earthH[i]);
    }
    lo = Math.max(-30, Math.floor(lo - 0.5));
    hi = Math.min(30, Math.ceil(hi + 0.5));
    const Y = (v) => top + ((hi - v) / (hi - lo)) * ch;
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.left, top, plotW, ch); ctx.clip();
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(PAD.left, top, plotW, ch);
    ctx.fillStyle = 'rgba(112,118,132,0.35)';         // below the horizon = ground
    ctx.fillRect(PAD.left, Y(0), plotW, top + ch - Y(0));
    const step = hi - lo > 24 ? 10 : hi - lo > 10 ? 5 : 2;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      ctx.strokeStyle = v === 0 ? '#E8EEF8' : COLORS.grid;
      ctx.lineWidth = v === 0 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, Y(v)); ctx.lineTo(PAD.left + plotW, Y(v)); ctx.stroke();
    }
    for (const [arr, color] of [[series.earthH, COLORS.earth], [series.sunH, COLORS.sun]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { if (i === 0) ctx.moveTo(X(i), Y(arr[i])); else ctx.lineTo(X(i), Y(arr[i])); }
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,215,240,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD.left + 0.5, top + 0.5, plotW - 1, ch - 1);
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      if (Y(v) > top + 6 && Y(v) < top + ch - 6) ctx.fillText(v === 0 ? 'horizon' : fmtSigned(v, 0), PAD.left - 6, Y(v));
    }
  }

  // ---- strips: one column per screen pixel, averaging the samples that fall in it ----
  const cols = Math.max(1, Math.floor(plotW));
  STRIPS.forEach((strip, k) => {
    const y = stripsTop + k * (STRIP_H + STRIP_GAP);
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(PAD.left, y, plotW, STRIP_H);
    ctx.fillStyle = strip.color;
    for (let c = 0; c < cols; c++) {
      const i0 = Math.floor((c / cols) * n);
      const i1 = Math.max(i0 + 1, Math.floor(((c + 1) / cols) * n));
      let sum = 0;
      for (let i = i0; i < i1 && i < n; i++) {
        if (strip.key === 'sun') sum += series.sunFrac[i];
        else if (strip.key === 'earth') sum += series.earthUp[i];
        else sum += series.sunFrac[i] > 0.001 && series.earthUp[i] ? 1 : 0;
      }
      const v = sum / (i1 - i0);
      if (v <= 0.001) continue;
      ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, v);
      ctx.fillRect(PAD.left + (c / cols) * plotW, y, plotW / cols + 0.6, STRIP_H);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(200,215,240,0.4)';
    ctx.strokeRect(PAD.left + 0.5, y + 0.5, plotW - 1, STRIP_H - 1);
    ctx.fillStyle = strip.color;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(strip.label, PAD.left - 8, y + STRIP_H / 2);
    ctx.font = '12px system-ui, sans-serif';
  });

  // ---- cursor ----
  if (cursor != null && cursor >= 0 && cursor < n) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(cursor), PAD.top); ctx.lineTo(X(cursor), bottom); ctx.stroke();
  }

  return {
    indexAt(clientX) {
      const rect = canvas.getBoundingClientRect();
      const f = (clientX - rect.left - PAD.left) / plotW;
      return Math.round(Math.min(1, Math.max(0, f)) * (n - 1));
    },
  };
}

/** Sensible date labels for a span: weekly for short ranges, monthly for long ones. */
function dateTicks(startMs, spanDays) {
  const ticks = [];
  if (spanDays > 100) {
    const d = new Date(startMs);
    let ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    const every = spanDays > 250 ? 2 : 1;
    for (let k = 0; ms < startMs + spanDays * DAY; k++) {
      const m = new Date(ms);
      if (k % every === 0) ticks.push({ ms, label: `${MON[m.getUTCMonth()]} ${m.getUTCFullYear()}` });
      ms = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1);
    }
  } else {
    const stepDays = spanDays > 45 ? 14 : 7;
    for (let ms = startMs; ms <= startMs + spanDays * DAY; ms += stepDays * DAY) {
      const m = new Date(ms);
      ticks.push({ ms, label: `${m.getUTCDate()} ${MON[m.getUTCMonth()]}` });
    }
  }
  return ticks;
}

/**
 * Small line chart: overall score (0..100) against mission start date.
 * @param scores  one value per day from startMs
 * @param marks   day indices to highlight with a dot
 */
export function drawScoreCurve(canvas, { scores, startMs, marks = [] }) {
  const { ctx, w, h } = fitCanvas(canvas);
  const plotW = w - PAD.left - PAD.right;
  const top = PAD.top;
  const ph = h - PAD.top - PAD.bottom;
  const n = Math.max(2, scores.length);
  const X = (i) => PAD.left + (i / (n - 1)) * plotW;
  const Y = (v) => top + ((100 - v) / 100) * ph;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0f1e';
  ctx.fillRect(PAD.left, top, plotW, ph);
  ctx.font = '12px system-ui, sans-serif';
  ctx.lineWidth = 1;
  for (let v = 0; v <= 100; v += 25) {
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath(); ctx.moveTo(PAD.left, Y(v)); ctx.lineTo(PAD.left + plotW, Y(v)); ctx.stroke();
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(String(v), PAD.left - 6, Y(v));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const t of dateTicks(startMs, n - 1)) {
    const x = PAD.left + ((t.ms - startMs) / ((n - 1) * DAY)) * plotW;
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + ph); ctx.stroke();
    ctx.fillStyle = COLORS.dim;
    if (x > PAD.left + 16 && x < w - PAD.right - 16) ctx.fillText(t.label, x, top + ph + 8);
  }
  if (scores.length > 1) {
    ctx.strokeStyle = '#8ab4ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    scores.forEach((v, i) => { if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); });
    ctx.stroke();
    for (const m of marks) {
      if (m < 0 || m >= scores.length) continue;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0b0f1a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(m), Y(scores[m]), 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(200,215,240,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD.left + 0.5, top + 0.5, plotW - 1, ph - 1);
}
