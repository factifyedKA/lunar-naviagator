// "Timeline & scores" view: power/communication timeline for the chosen site and date
// range, the five headline numbers, the explainable overall score with adjustable
// weights, and the pre-computed whole-year ranking of all sites.

import { SITES, getSite } from './sites.js';
import { getState, setState, DAY, HOUR, startOfUtcDay } from './state.js';
import { summarize, compositeScore, fmtDuration, SCORE_PARTS, SCORE_CAP_H, DEFAULT_WEIGHTS } from './metrics.js';
import { seriesJob } from './compute.js';
import { data, siteModel, modelKey, horizonNote } from './model.js';
import { drawTimeline, timelineHeight } from './chart.js';
import { $, el, fmtDate, fmtDateTime, fmtSigned, fmtLat, fmtLon } from './ui.js';
import { downloadCsv, downloadPng, slug } from './export.js';

let requestRender = () => {};
let cache = { key: null, series: null, summary: null, busy: false };
let chartGeom = null;
let cursor = null; // sample index the user tapped
let cursorRange = ''; // the date range the cursor belongs to

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

export function initTimelineView(onChange) {
  requestRender = onChange;

  $('#tl-start').addEventListener('change', (ev) => {
    const t = Date.parse(`${ev.target.value}T00:00Z`);
    if (Number.isFinite(t) && t > Date.UTC(1970, 0, 2) && t < Date.UTC(2099, 0, 1)) setState({ rs: t });
    else requestRender();
  });
  $('#tl-days').addEventListener('change', (ev) => setState({ rd: Number(ev.target.value) }));
  $('#tl-today').addEventListener('click', () => setState({ rs: startOfUtcDay(Date.now()) }));
  $('#tl-goto').addEventListener('click', () => {
    const s = getState();
    if (cursor != null) setState({ view: 'explore', t: s.rs + cursor * HOUR, playing: false });
  });

  $('#tl-csv').addEventListener('click', exportCsv);
  $('#tl-png').addEventListener('click', () => {
    const s = getState();
    const site = getSite(s.site, s.lat, s.lon);
    if (cache.series) downloadPng(`timeline-${slug(site.name)}-${iso(s.rs)}-${s.rd}d.png`,
      `Power and communication timeline · ${site.name} · ${fmtDate(s.rs)} to ${fmtDate(s.rs + s.rd * DAY)}`, [{ canvas: $('#tl-chart') }],
      `Sunlit ${cache.summary.sunlitPct.toFixed(1)}%, Earth visible ${cache.summary.earthPct.toFixed(1)}%, both ${cache.summary.overlapPct.toFixed(1)}%.`);
  });
  $('#rank-csv').addEventListener('click', () => {
    const s = getState();
    const sim = data.yearSim;
    if (!sim) return;
    const mode = s.hm === 'flat' ? 'flat' : 'terrain';
    const rows = SITES.map((site) => ({ site, m: sim.sites[site.id][mode], score: compositeScore(sim.sites[site.id][mode], s.w).score }))
      .sort((a, b) => b.score - a.score);
    downloadCsv(`year-ranking-${sim.year}.csv`, [
      `Lunar Landing Site Navigator - whole-year ranking ${sim.year}, hourly steps`,
      `horizon model: ${mode}; Earth minimum elevation: 0 deg; score weights (sun,dark,earth,gap,both): ${s.w.join(' ')}`,
    ], [['rank', 'site', 'score_0_100', 'sunlit_pct', 'longest_darkness_h', 'earth_visible_pct', 'longest_radio_gap_h', 'sun_and_earth_pct'],
      ...rows.map((r, i) => [i + 1, r.site.name, r.score.toFixed(1), r.m.sunlitPct, r.m.longestDarkH, r.m.earthPct, r.m.longestOutageH, r.m.overlapPct])]);
  });

  // tap or drag on the chart to read exact values
  const canvas = $('#tl-chart');
  const pick = (ev) => { if (chartGeom) { cursor = chartGeom.indexAt(ev.clientX); requestRender(); } };
  canvas.addEventListener('pointerdown', (ev) => { canvas.setPointerCapture(ev.pointerId); pick(ev); });
  canvas.addEventListener('pointermove', (ev) => { if (ev.buttons || ev.pointerType === 'touch') pick(ev); });
  canvas.addEventListener('keydown', (ev) => {
    if (!cache.series) return;
    const n = cache.series.sunFrac.length;
    const step = ev.shiftKey ? 24 : 1;
    if (ev.key === 'ArrowRight') cursor = Math.min(n - 1, (cursor ?? 0) + step);
    else if (ev.key === 'ArrowLeft') cursor = Math.max(0, (cursor ?? 0) - step);
    else return;
    ev.preventDefault();
    requestRender();
  });

  // weight sliders
  const box = $('#tl-weights');
  SCORE_PARTS.forEach((p, i) => {
    const id = `w-${p.key}`;
    box.append(el('div', { class: 'weight-row' }, [
      el('label', { for: id }, [el('strong', { text: p.label }), el('span', { class: 'note-inline', text: ` — ${p.what}` })]),
      el('input', { type: 'range', id, min: '0', max: '5', step: '1',
        oninput: (ev) => { const w = getState().w.slice(); w[i] = Number(ev.target.value); setState({ w }); } }),
      el('output', { id: `${id}-out`, for: id }),
    ]));
  });
  $('#tl-reset').addEventListener('click', () => setState({ w: DEFAULT_WEIGHTS.slice() }));
}

/** Starts (or reuses) the calculation for the current site, range and settings. */
function ensureSeries(s, model) {
  const key = `${modelKey(model)}|${s.rs}|${s.rd}|${s.emin}`;
  if (cache.key === key) return;
  cache = { key, series: null, summary: null, busy: true };
  if (cursorRange !== `${s.rs}|${s.rd}`) { cursor = null; cursorRange = `${s.rs}|${s.rd}`; } // keep the cursor if only settings changed
  seriesJob([model], s.rs, s.rd * 24, s.emin).then(([series]) => {
    if (cache.key !== key) return; // the user has already changed something else
    cache.series = series;
    cache.summary = summarize(series);
    cache.busy = false;
    requestRender();
  }, () => { if (cache.key === key) { cache.busy = false; requestRender(); } });
}

function exportCsv() {
  const s = getState();
  if (!cache.series) return;
  const site = getSite(s.site, s.lat, s.lon);
  const model = siteModel(s, site, requestRender);
  const c = cache.series;
  const m = cache.summary;
  const rows = [['time_utc', 'sun_height_above_horizon_deg', 'sun_disc_fraction_in_view', 'earth_height_above_horizon_deg', 'earth_link_possible']];
  for (let i = 0; i < c.sunFrac.length; i++) {
    rows.push([new Date(s.rs + i * HOUR).toISOString().slice(0, 16) + 'Z', c.sunH[i].toFixed(3), c.sunFrac[i].toFixed(3), c.earthH[i].toFixed(3), c.earthUp[i]]);
  }
  downloadCsv(`timeline-${slug(site.name)}-${iso(s.rs)}-${s.rd}d.csv`, [
    'Lunar Landing Site Navigator - power and communication timeline',
    `site: ${site.name} (${fmtLat(site.lat)} ${fmtLon(site.lon)}${site.approx ? ', approximate marker' : ''})`,
    `viewpoint used: ${fmtLat(model.lat)} ${fmtLon(model.lon)}, height ${Math.round((model.heightKm || 0) * 1000)} m`,
    horizonNote(model),
    `Earth minimum elevation for a link: ${s.emin} deg`,
    `summary: sunlit ${m.sunlitPct.toFixed(2)}%, longest darkness ${m.longestDarkH} h, Earth visible ${m.earthPct.toFixed(2)}%, longest radio gap ${m.longestOutageH} h, both ${m.overlapPct.toFixed(2)}%`,
  ], rows);
}

export function renderTimelineView() {
  const s = getState();
  const site = getSite(s.site, s.lat, s.lon);
  const model = siteModel(s, site, requestRender);
  ensureSeries(s, model);

  $('#tl-site').textContent = site.name;
  if (document.activeElement !== $('#tl-start')) $('#tl-start').value = iso(s.rs);
  $('#tl-days').value = String(s.rd);
  const end = s.rs + s.rd * DAY;

  const canvas = $('#tl-chart');
  const curves = s.mode === 'expert'; // Simple mode shows just the three strips
  canvas.style.height = `${timelineHeight(curves)}px`;
  $('#tl-busy').hidden = Boolean(cache.series);
  $('#tl-busy').textContent = cache.busy ? 'Calculating…' : 'The calculation could not be completed. Please try another date.';
  canvas.style.visibility = cache.series ? 'visible' : 'hidden';
  if (!cache.series) return;

  chartGeom = drawTimeline(canvas, { series: cache.series, startMs: s.rs, curves, cursor });
  $('#tl-caption').textContent = `${site.name}, ${fmtDate(s.rs)} to ${fmtDate(end)} (${s.rd} days, one sample per hour). `
    + (curves ? 'Top: height of the Sun (yellow) and the Earth (blue) above the local horizon. ' : '')
    + 'Strips: yellow = some sunlight for power, blue = Earth in view for a direct radio link'
    + `${s.emin > 0 ? ` (at least ${s.emin}° above the horizon)` : ''}, green = both together; dark = neither. `
    + horizonNote(model);
  canvas.setAttribute('aria-label', `Timeline for ${site.name}: Sun in view ${cache.summary.sunlitPct.toFixed(0)}% of the time, `
    + `Earth in view ${cache.summary.earthPct.toFixed(0)}%, both ${cache.summary.overlapPct.toFixed(0)}%. Use arrow keys to move the cursor.`);

  // cursor read-out
  if (cursor != null) {
    const c = cache.series;
    $('#tl-cursor').textContent = `${fmtDateTime(s.rs + cursor * HOUR)} — Sun ${fmtSigned(c.sunH[cursor])} `
      + `(${Math.round(c.sunFrac[cursor] * 100)}% of disc in view), Earth ${fmtSigned(c.earthH[cursor])} `
      + `(${c.earthUp[cursor] ? 'link possible' : 'no link'}).`;
  } else {
    $('#tl-cursor').textContent = 'Tap or drag on the chart to read exact values.';
  }
  $('#tl-goto').hidden = cursor == null;

  renderScores(s, cache.summary);
  renderRanking(s);
}

function tile(label, value, text, color) {
  return el('div', { class: 'tile' }, [
    el('p', { class: 'tile-label', text: label }),
    el('p', { class: 'tile-value', style: color ? `color:${color}` : null, text: value }),
    el('p', { class: 'tile-text', text }),
  ]);
}

function renderScores(s, m) {
  const when = (idx) => (idx >= 0 ? ` (starting ${fmtDate(s.rs + idx * HOUR)})` : '');
  const tiles = $('#tl-tiles');
  tiles.textContent = '';
  tiles.append(
    tile('Sunlit', `${m.sunlitPct.toFixed(1)}%`, 'Average share of the Sun in view — power potential.', 'var(--sun)'),
    tile('Longest darkness', fmtDuration(m.longestDarkH), `Longest stretch with no Sun at all${when(m.darkStart)}.`),
    tile('Earth visible', `${m.earthPct.toFixed(1)}%`, 'Share of time a direct radio link to Earth is possible.', 'var(--earth)'),
    tile('Longest radio gap', fmtDuration(m.longestOutageH), `Longest stretch with no Earth in view${when(m.outageStart)}.`),
    tile('Sun and Earth together', `${m.overlapPct.toFixed(1)}%`, 'Share of time with power and a radio link at once.', '#3fd0a4'),
  );

  const c = compositeScore(m, s.w);
  $('#tl-score').textContent = c.totalWeight > 0 ? Math.round(c.score) : '–';
  const sorted = c.parts.filter((p) => p.weight > 0).sort((a, b) => b.value - a.value);
  $('#tl-score-text').textContent = c.totalWeight === 0
    ? 'All weights are zero — raise at least one slider below.'
    : `Out of 100. Strongest point: “${sorted[0].label}” (${Math.round(sorted[0].value)}/100). `
      + `Weakest point: “${sorted[sorted.length - 1].label}” (${Math.round(sorted[sorted.length - 1].value)}/100).`;

  const measured = [`${m.sunlitPct.toFixed(1)}%`, fmtDuration(m.longestDarkH), `${m.earthPct.toFixed(1)}%`,
    fmtDuration(m.longestOutageH), `${m.overlapPct.toFixed(1)}%`];
  const body = $('#tl-why tbody');
  body.textContent = '';
  c.parts.forEach((p, i) => {
    body.append(el('tr', {}, [
      el('th', { scope: 'row', text: p.label }),
      el('td', { text: measured[i] }),
      el('td', { text: `${Math.round(p.value)} / 100` }),
      el('td', { text: `× ${p.weight}` }),
      el('td', { text: p.points.toFixed(1) }),
    ]));
    $(`#w-${p.key}`).value = String(p.weight);
    $(`#w-${p.key}-out`).textContent = String(p.weight);
  });
  body.append(el('tr', { class: 'total' }, [
    el('th', { scope: 'row', text: 'Overall score' }), el('td'), el('td'),
    el('td', { text: `÷ ${c.totalWeight}` }), el('td', { text: c.totalWeight > 0 ? c.score.toFixed(1) : '–' }),
  ]));
  $('#tl-why-note').textContent = `Each part is turned into a 0–100 mark. Percentages are used as they are. `
    + `For the longest darkness and the longest radio gap, 0 hours = 100 and ${SCORE_CAP_H / 24} days or more = 0. `
    + 'The overall score is the average of the marks, counted as many times as their weight.';
}

function renderRanking(s) {
  const table = $('#rank-table tbody');
  table.textContent = '';
  const sim = data.yearSim;
  $('#rank-card').hidden = !sim;
  if (!sim) return;
  const mode = s.hm === 'flat' ? 'flat' : 'terrain';
  const rows = SITES.map((site) => {
    const m = sim.sites[site.id][mode];
    return { site, m, score: compositeScore(m, s.w).score };
  }).sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => {
    table.append(el('tr', { class: r.site.id === s.site ? 'selected' : null }, [
      el('td', { text: String(i + 1) }),
      el('th', { scope: 'row' }, el('button', { type: 'button', class: 'link-btn', text: r.site.name,
        onclick: () => setState({ site: r.site.id }) })),
      el('td', { class: 'strong', text: r.score.toFixed(0) }),
      el('td', { text: `${r.m.sunlitPct.toFixed(0)}%` }),
      el('td', { text: fmtDuration(r.m.longestDarkH) }),
      el('td', { text: `${r.m.earthPct.toFixed(0)}%` }),
      el('td', { text: fmtDuration(r.m.longestOutageH) }),
      el('td', { text: `${r.m.overlapPct.toFixed(0)}%` }),
    ]));
  });
  $('#rank-caption').textContent = `All listed sites over the whole of ${sim.year} (hourly steps), ranked by overall score with your current weights. `
    + (mode === 'terrain'
      ? 'Uses the real-terrain horizons (NASA LOLA, 240 m grid), observer 2 m above the highest ground near each marker. '
      : 'Uses the flat-horizon simplification at 0° (the horizon-height slider does not apply here). ')
    + 'Earth counts as visible from 0° above the horizon. Tap a name to select that site.';
}
