// "Best window" view: the user gives a mission length; the tool scores every possible
// start date in the search period (for one site or for all listed sites) and ranks them.

import { SITES, getSite } from './sites.js';
import { getState, setState, DAY, HOUR, RANGE_DAYS, startOfUtcDay } from './state.js';
import { topWindows, fmtDuration } from './metrics.js';
import { windowsJob } from './compute.js';
import { siteModel, modelKey, horizonNote } from './model.js';
import { drawScoreCurve } from './chart.js';
import { $, el, fmtDate } from './ui.js';
import { downloadCsv, downloadPng, slug } from './export.js';

let requestRender = () => {};
let cache = { key: null, result: null, busy: false }; // result: [{ site, model, windows }]
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
let lastTop = []; // the ranking currently shown (for CSV export)

export function initFinderView(onChange) {
  requestRender = onChange;
  $('#fw-length').addEventListener('change', (ev) => {
    const v = Math.round(Number(ev.target.value));
    if (Number.isFinite(v) && v >= 1 && v <= 60) setState({ ml: v }); else requestRender();
  });
  for (const b of document.querySelectorAll('[data-ml]')) b.addEventListener('click', () => setState({ ml: Number(b.dataset.ml) }));
  $('#fw-start').addEventListener('change', (ev) => {
    const t = Date.parse(`${ev.target.value}T00:00Z`);
    if (Number.isFinite(t) && t > Date.UTC(1970, 0, 2) && t < Date.UTC(2098, 0, 1)) setState({ rs: t }); else requestRender();
  });
  $('#fw-span').addEventListener('change', (ev) => setState({ fd: Number(ev.target.value) }));
  $('#fw-all').addEventListener('click', () => setState({ sc: 'all' }));
  $('#fw-site').addEventListener('click', () => setState({ sc: 'site' }));
  $('#fw-today').addEventListener('click', () => setState({ rs: startOfUtcDay(Date.now()) }));
  $('#fw-png').addEventListener('click', () => downloadPng(`best-window-${slug($('#fw-chart-title').textContent)}.png`,
    `${$('#fw-chart-title').textContent} · ${getState().ml}-day mission`, [{ canvas: $('#fw-chart') }], 'Overall score (0-100) by mission start date.'));
  $('#fw-csv').addEventListener('click', () => {
    const s = getState();
    if (!lastTop.length) return;
    downloadCsv(`best-windows-${s.ml}d.csv`, ['Lunar Landing Site Navigator - best landing windows',
      `mission length ${s.ml} days; searched ${iso(s.rs)} + ${s.fd} days; Earth minimum elevation ${s.emin} deg; horizon model ${s.hm}; score weights (sun,dark,earth,gap,both): ${s.w.join(' ')}`],
    [['rank', 'site', 'start_utc', 'end_utc', 'score_0_100', 'sunlit_pct', 'longest_darkness_h', 'earth_visible_pct', 'longest_radio_gap_h', 'sun_and_earth_pct'],
      ...lastTop.map((w, i) => [i + 1, w.site.name, iso(s.rs + w.start * HOUR), iso(s.rs + w.start * HOUR + s.ml * DAY), w.score.toFixed(1),
        w.summary.sunlitPct.toFixed(2), w.summary.longestDarkH, w.summary.earthPct.toFixed(2), w.summary.longestOutageH, w.summary.overlapPct.toFixed(2)])]);
  });
}

export function renderFinderView() {
  const s = getState();
  const current = getSite(s.site, s.lat, s.lon);
  if (document.activeElement !== $('#fw-length')) $('#fw-length').value = String(s.ml);
  if (document.activeElement !== $('#fw-start')) $('#fw-start').value = iso(s.rs);
  $('#fw-span').value = String(s.fd);
  $('#fw-all').setAttribute('aria-pressed', String(s.sc === 'all'));
  $('#fw-site').setAttribute('aria-pressed', String(s.sc === 'site'));
  $('#fw-site').textContent = `Only ${current.name}`;
  for (const b of document.querySelectorAll('[data-ml]')) b.setAttribute('aria-pressed', String(Number(b.dataset.ml) === s.ml));

  // which sites to search (the selected one is always included so its curve can be drawn)
  const sites = s.sc === 'all' ? [...SITES, ...(current.group === 'custom' ? [current] : [])] : [current];
  const models = sites.map((site) => siteModel(s, site, requestRender));
  const key = `${models.map(modelKey).join(';')}|${s.rs}|${s.fd}|${s.emin}|${s.ml}|${s.w.join()}`;
  if (cache.key !== key) {
    cache = { key, result: null, busy: true };
    windowsJob(models, s.rs, s.fd * 24, s.emin, s.ml * 24, s.w).then((lists) => {
      if (cache.key !== key) return;
      cache.result = lists.map((windows, i) => ({ site: sites[i], model: models[i], windows }));
      cache.busy = false;
      requestRender();
    }, () => { if (cache.key === key) { cache.busy = false; requestRender(); } });
  }

  $('#fw-busy').hidden = Boolean(cache.result);
  $('#fw-busy').textContent = cache.busy ? 'Searching every start date…' : 'The search could not be completed. Please try other settings.';
  $('#fw-results').hidden = !cache.result;
  if (!cache.result) return;

  // ranking: best non-overlapping windows (per site), highest score first
  const all = cache.result.flatMap((r) => r.windows.map((w) => ({ ...w, site: r.site })));
  const top = topWindows(all, 10, s.ml * 24, (w) => w.site.id);
  lastTop = top;
  const body = $('#fw-table tbody');
  body.textContent = '';
  top.forEach((w, i) => {
    const startMs = s.rs + w.start * HOUR;
    body.append(el('tr', { class: i === 0 ? 'selected' : null }, [
      el('td', { text: String(i + 1) }),
      el('th', { scope: 'row', text: w.site.name }),
      el('td', { text: `${fmtDate(startMs)} – ${fmtDate(startMs + s.ml * DAY)}` }),
      el('td', { class: 'strong', text: w.score.toFixed(0) }),
      el('td', { text: `${w.summary.sunlitPct.toFixed(0)}%` }),
      el('td', { text: fmtDuration(w.summary.longestDarkH) }),
      el('td', { text: `${w.summary.earthPct.toFixed(0)}%` }),
      el('td', { text: fmtDuration(w.summary.longestOutageH) }),
      el('td', {}, el('button', { type: 'button', class: 'btn small', text: 'Open timeline',
        'aria-label': `Open timeline for ${w.site.name} from ${fmtDate(startMs)}`,
        onclick: () => setState({ view: 'timeline', site: w.site.id, rs: startMs, rd: RANGE_DAYS.find((d) => d >= s.ml) || 60 }) })),
    ]));
  });
  const best = top[0];
  $('#fw-answer').textContent = best
    ? `Best ${s.ml}-day window: ${best.site.name}, starting ${fmtDate(s.rs + best.start * HOUR)} — score ${best.score.toFixed(0)} out of 100 `
      + `(sunlit ${best.summary.sunlitPct.toFixed(0)}%, Earth visible ${best.summary.earthPct.toFixed(0)}%, longest darkness ${fmtDuration(best.summary.longestDarkH)}).`
    : 'The search period is shorter than the mission. Choose a longer period.';
  $('#fw-table-caption').textContent = `Every start date (one per day, 00:00 UTC) from ${fmtDate(s.rs)} to ${fmtDate(s.rs + (s.fd - s.ml) * DAY)} was scored for a `
    + `${s.ml}-day mission using your current score weights (set on the Timeline & scores tab). Windows of the same site never overlap in this list. `
    + horizonNote(cache.result[0].model);

  // curve: how the score changes with the start date, for the selected site
  const mine = cache.result.find((r) => r.site.id === current.id) || cache.result[0];
  const marks = top.filter((w) => w.site.id === mine.site.id).map((w) => w.start / 24);
  drawScoreCurve($('#fw-chart'), { scores: mine.windows.map((w) => w.score), startMs: s.rs, marks });
  $('#fw-chart-title').textContent = `Score by start date · ${mine.site.name}`;
  $('#fw-chart-caption').textContent = `Each point is the overall score of a ${s.ml}-day mission at ${mine.site.name} starting on that date. `
    + 'Higher is better. White dots mark this site’s windows that appear in the ranking above.';
  const scores = mine.windows.map((w) => w.score);
  $('#fw-chart').setAttribute('aria-label', scores.length
    ? `Score by start date for ${mine.site.name}: lowest ${Math.min(...scores).toFixed(0)}, highest ${Math.max(...scores).toFixed(0)}.` : 'No data');
}
