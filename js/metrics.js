// Power and communication metrics: turns Sun/Earth positions into "is there sunlight?",
// "can we talk to Earth?" over a date range, then into scores.
// Pure maths (no browser code): used by the app, the Web Worker, Node tests and tools.

import { moonFrame, skyAt, discFractionVisible, sunEarthSkySeparation } from './astro.js';
import { maskAt } from './terrain.js';

const HOUR = 3600e3;

/**
 * A "site model" says where the observer is and what their horizon looks like:
 *   { lat, lon, heightKm, mask, hz }
 * mask = 360 terrain-horizon elevations (real terrain) or null for a flat horizon at hz°.
 */
export function horizonElevation(model, az) {
  return model.mask ? maskAt(model.mask, az) : (model.hz || 0);
}

/**
 * Visibility at one instant.
 * @param sky   result of skyAt()
 * @param emin  minimum height of the Earth above the local horizon for a radio link (deg)
 * @returns sunH / earthH = height of the centre above the local horizon (deg),
 *          sunFrac = fraction of the Sun's disc in view (0..1, reduced during eclipses),
 *          earthUp = true when a direct-to-Earth link is possible
 */
export function visibility(sky, model, emin = 0) {
  const sunH = sky.sun.el - horizonElevation(model, sky.sun.az);
  const earthH = sky.earth.el - horizonElevation(model, sky.earth.az);
  let sunFrac = discFractionVisible(sunH, sky.sun.radius);
  let eclipse = false;
  if (sunFrac > 0) {
    // Earth in front of the Sun (a lunar eclipse seen from the Moon). Approximation: the
    // covered share grows linearly as the discs overlap.
    const overlap = (sky.earth.radius + sky.sun.radius - sunEarthSkySeparation(sky)) / (2 * sky.sun.radius);
    if (overlap > 0) { eclipse = true; sunFrac *= 1 - Math.min(1, overlap); }
  }
  return { sunH, earthH, sunFrac, earthUp: earthH >= emin, eclipse };
}

/**
 * Time series for one or more site models over a date range.
 * The ephemeris is computed once per time step and shared by all sites.
 * @returns array (one per model) of { sunFrac, earthUp, sunH, earthH } typed arrays
 */
export function computeSeries(models, startMs, hours, emin = 0, stepHours = 1) {
  const n = Math.floor(hours / stepHours) + 1;
  const out = models.map(() => ({
    sunFrac: new Float32Array(n), earthUp: new Uint8Array(n), sunH: new Float32Array(n), earthH: new Float32Array(n),
  }));
  for (let i = 0; i < n; i++) {
    const frame = moonFrame(startMs + i * stepHours * HOUR);
    for (let k = 0; k < models.length; k++) {
      const m = models[k];
      const v = visibility(skyAt(frame, m.lat, m.lon, m.heightKm || 0), m, emin);
      out[k].sunFrac[i] = v.sunFrac;
      out[k].earthUp[i] = v.earthUp ? 1 : 0;
      out[k].sunH[i] = v.sunH;
      out[k].earthH[i] = v.earthH;
    }
  }
  return out;
}

const LIT = 0.001; // the Sun counts as "in view" when more than 0.1% of its disc shows

/** Longest run of samples for which test(i) is true: { hours, startIndex }. */
function longestRun(n, stepHours, test, from = 0) {
  let best = 0, bestStart = -1, run = 0;
  for (let i = from; i < from + n; i++) {
    if (test(i)) { run++; if (run > best) { best = run; bestStart = i - run + 1; } } else run = 0;
  }
  return { hours: best * stepHours, startIndex: bestStart };
}

/**
 * The five headline numbers for (part of) a series.
 * @param from, count  optional sub-range in samples (used by the best-window finder)
 */
export function summarize(series, stepHours = 1, from = 0, count = series.sunFrac.length - from) {
  let sun = 0, earth = 0, both = 0;
  for (let i = from; i < from + count; i++) {
    sun += series.sunFrac[i];
    earth += series.earthUp[i];
    if (series.sunFrac[i] > LIT && series.earthUp[i]) both++;
  }
  const dark = longestRun(count, stepHours, (i) => series.sunFrac[i] <= LIT, from);
  const outage = longestRun(count, stepHours, (i) => !series.earthUp[i], from);
  return {
    sunlitPct: (100 * sun) / count,            // average share of the Sun's disc in view
    longestDarkH: dark.hours, darkStart: dark.startIndex,
    earthPct: (100 * earth) / count,
    longestOutageH: outage.hours, outageStart: outage.startIndex,
    overlapPct: (100 * both) / count,
  };
}

// ---- composite score ------------------------------------------------------------------
export const SCORE_CAP_H = 360; // 15 days: a darkness/outage this long (or longer) scores 0
export const SCORE_PARTS = [
  { key: 'sun', label: 'Sunlight', what: 'average share of the Sun in view' },
  { key: 'dark', label: 'Short nights', what: 'longest time with no Sun at all' },
  { key: 'earth', label: 'Earth in view', what: 'share of time a direct radio link is possible' },
  { key: 'outage', label: 'Short radio gaps', what: 'longest time with no Earth in view' },
  { key: 'both', label: 'Sun and Earth together', what: 'share of time with both at once' },
];
export const DEFAULT_WEIGHTS = [3, 2, 2, 1, 2];

/**
 * Composite score 0..100 = weighted average of five part-scores (each 0..100).
 * Returns the score and a row per part so the result can be explained:
 *   points = how many of the final score's points come from this part.
 */
export function compositeScore(summary, weights = DEFAULT_WEIGHTS) {
  const values = [
    summary.sunlitPct,
    100 * (1 - Math.min(1, summary.longestDarkH / SCORE_CAP_H)),
    summary.earthPct,
    100 * (1 - Math.min(1, summary.longestOutageH / SCORE_CAP_H)),
    summary.overlapPct,
  ];
  const total = weights.reduce((a, b) => a + b, 0);
  const parts = SCORE_PARTS.map((p, i) => ({
    ...p, value: values[i], weight: weights[i], points: total > 0 ? (values[i] * weights[i]) / total : 0,
  }));
  return { score: parts.reduce((a, p) => a + p.points, 0), parts, totalWeight: total };
}

/** "3 d 5 h" / "7 h" */
export function fmtDuration(hours) {
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  if (d === 0) return `${h} h`;
  return h === 0 ? `${d} d` : `${d} d ${h} h`;
}

// ---- best-window finder -----------------------------------------------------------------
/**
 * Scores every possible mission start inside a series.
 * @param series        from computeSeries() (hourly samples)
 * @param missionHours  mission length
 * @param weights       score weights
 * @param stepHours     try a start every this many hours (default: once a day)
 * @returns [{ start, score, summary }] — start is a sample index (hours from the series start)
 */
export function findWindows(series, missionHours, weights = DEFAULT_WEIGHTS, stepHours = 24) {
  const n = series.sunFrac.length;
  const out = [];
  for (let start = 0; start + missionHours < n; start += stepHours) {
    const summary = summarize(series, 1, start, missionHours);
    out.push({ start, score: compositeScore(summary, weights).score, summary });
  }
  return out;
}

/**
 * Picks the best windows that do not overlap each other (highest score first).
 * @param windows  from findWindows(); each may carry extra fields (e.g. the site)
 * @param count    how many to return
 * @param missionHours  windows closer together than this (for the same key) are skipped
 * @param keyOf    optional: windows with different keys (e.g. different sites) may overlap
 */
export function topWindows(windows, count, missionHours, keyOf = () => '') {
  const sorted = windows.slice().sort((a, b) => b.score - a.score || a.start - b.start);
  const picked = [];
  for (const w of sorted) {
    if (picked.some((p) => keyOf(p) === keyOf(w) && Math.abs(p.start - w.start) < missionHours)) continue;
    picked.push(w);
    if (picked.length >= count) break;
  }
  return picked;
}
