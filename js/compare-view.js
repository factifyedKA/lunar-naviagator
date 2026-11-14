// "Compare" view: up to four sites and/or start dates side by side, with the same
// timeline strips and the same numbers, so differences are easy to spot.

import { SITES, CUSTOM_ID, getSite } from './sites.js';
import { getState, setState, DAY } from './state.js';
import { summarize, compositeScore, fmtDuration } from './metrics.js';
import { seriesJob } from './compute.js';
import { siteModel, modelKey, horizonNote } from './model.js';
import { drawTimeline, timelineHeight } from './chart.js';
import { $, el, fmtDate } from './ui.js';

let requestRender = () => {};
const LETTERS = ['A', 'B', 'C', 'D'];
const cache = new Map(); // key -> { series, summary } | 'busy' | 'failed'
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The compare slots; if the user has not chosen any yet, a sensible default. */
export function compareSlots(s) {
  if (s.cmp) return s.cmp;
  const ids = [s.site, 'ridge', 'malapert', 'mouton'].filter((id, i, a) => a.indexOf(id) === i).slice(0, 3);
  return [...ids.map((id) => ({ id, start: s.rs })), null];
}

export function initCompareView(onChange) {
  requestRender = onChange;
  const box = $('#cmp-slots');
  LETTERS.forEach((letter, i) => {
    const change = (patch) => {
      const s = getState();
      const slots = compareSlots(s).slice();
      slots[i] = patch === null ? null : { ...(slots[i] || { id: s.site, start: s.rs }), ...patch };
      setState({ cmp: slots });
    };
    box.append(el('div', { class: 'slot' }, [
      el('span', { class: 'slot-letter', 'aria-hidden': 'true', text: letter }),
      el('label', { class: 'field' }, [`Site ${letter}`,
        el('select', { id: `cmp-site-${i}`, onchange: (ev) => change(ev.target.value ? { id: ev.target.value } : null) })]),
      el('label', { class: 'field' }, ['Start date (UTC)',
        el('input', { type: 'date', id: `cmp-date-${i}`, min: '1970-01-02', max: '2098-12-31',
          onchange: (ev) => { const t = Date.parse(`${ev.target.value}T00:00Z`); if (Number.isFinite(t)) change({ start: t }); else requestRender(); } })]),
    ]));
  });
  $('#cmp-days').addEventListener('change', (ev) => setState({ rd: Number(ev.target.value) }));
}

function ensure(key, model, start, s) {
  if (cache.has(key)) return;
  cache.set(key, 'busy');
  if (cache.size > 40) cache.delete(cache.keys().next().value); // keep memory small
  seriesJob([model], start, s.rd * 24, s.emin).then(
    ([series]) => cache.set(key, { series, summary: summarize(series) }),
    () => cache.set(key, 'failed'),
  ).then(requestRender);
}

export function renderCompareView() {
  const s = getState();
  const slots = compareSlots(s);
  const hasCustom = s.site === CUSTOM_ID || slots.some((c) => c && c.id === CUSTOM_ID);
  $('#cmp-days').value = String(s.rd);

  // slot controls
  slots.forEach((slot, i) => {
    const sel = $(`#cmp-site-${i}`);
    const want = ['', ...SITES.map((x) => x.id), ...(hasCustom ? [CUSTOM_ID] : [])];
    if (sel.options.length !== want.length) {
      sel.textContent = '';
      sel.append(el('option', { value: '', text: '— empty —' }));
      for (const x of SITES) sel.append(el('option', { value: x.id, text: `${x.n} · ${x.name}` }));
      if (hasCustom) sel.append(el('option', { value: CUSTOM_ID, text: '★ · Custom point' }));
    }
    sel.value = slot ? slot.id : '';
    const date = $(`#cmp-date-${i}`);
    date.disabled = !slot;
    if (document.activeElement !== date) date.value = slot ? iso(slot.start) : '';
  });

  // results
  const charts = $('#cmp-charts');
  const used = slots.map((slot, i) => ({ slot, i })).filter((x) => x.slot);
  const rows = used.map(({ slot, i }) => {
    const site = getSite(slot.id, s.lat, s.lon);
    const model = siteModel(s, site, requestRender);
    const key = `${modelKey(model)}|${slot.start}|${s.rd}|${s.emin}`;
    ensure(key, model, slot.start, s);
    return { letter: LETTERS[i], site, slot, model, res: cache.get(key) };
  });

  // one chart block per slot (rebuilt only when the number of slots changes)
  if (charts.children.length !== rows.length) {
    charts.textContent = '';
    rows.forEach(() => charts.append(el('div', { class: 'cmp-block' }, [
      el('p', { class: 'cmp-title' }), el('canvas', { class: 'chart', role: 'img' }), el('p', { class: 'busy-line', text: 'Calculating…' }),
    ])));
  }
  rows.forEach((r, k) => {
    const block = charts.children[k];
    const ready = r.res && typeof r.res === 'object';
    block.children[0].textContent = `${r.letter} · ${r.site.name} — ${fmtDate(r.slot.start)} to ${fmtDate(r.slot.start + s.rd * DAY)}`;
    block.children[1].style.height = `${timelineHeight(false)}px`;
    block.children[1].hidden = !ready;
    block.children[2].hidden = ready;
    block.children[2].textContent = r.res === 'failed' ? 'This one could not be calculated.' : 'Calculating…';
    if (ready) {
      drawTimeline(block.children[1], { series: r.res.series, startMs: r.slot.start, curves: false });
      block.children[1].setAttribute('aria-label', `${r.site.name}: Sun ${r.res.summary.sunlitPct.toFixed(0)}%, `
        + `Earth ${r.res.summary.earthPct.toFixed(0)}%, both ${r.res.summary.overlapPct.toFixed(0)}% of the time.`);
    }
  });
  $('#cmp-empty').hidden = rows.length > 0;
  $('#cmp-caption').textContent = rows.length === 0 ? '' : `Each block covers ${s.rd} days from its own start date, one sample per hour. `
    + 'Yellow = some sunlight for power, blue = Earth in view for a direct radio link'
    + `${s.emin > 0 ? ` (at least ${s.emin}° above the horizon)` : ''}, green = both together, dark = neither. `
    + horizonNote(rows[0].model);

  // numbers table: one column per slot, best value in each row marked with a star
  const ready = rows.filter((r) => r.res && typeof r.res === 'object');
  const head = $('#cmp-table thead tr');
  const body = $('#cmp-table tbody');
  head.textContent = '';
  body.textContent = '';
  $('#cmp-table-card').hidden = ready.length === 0;
  if (ready.length === 0) return;
  head.append(el('th', { scope: 'col', text: 'Measure' }));
  ready.forEach((r) => head.append(el('th', { scope: 'col' }, [`${r.letter} · ${r.site.name}`, el('br'), el('small', { text: `from ${fmtDate(r.slot.start)}` })])));
  const lines = [
    { label: 'Overall score (0–100)', get: (m) => compositeScore(m, s.w).score, fmt: (v) => v.toFixed(0), best: 'max' },
    { label: 'Sunlit', get: (m) => m.sunlitPct, fmt: (v) => `${v.toFixed(1)}%`, best: 'max' },
    { label: 'Longest darkness', get: (m) => m.longestDarkH, fmt: fmtDuration, best: 'min' },
    { label: 'Earth visible', get: (m) => m.earthPct, fmt: (v) => `${v.toFixed(1)}%`, best: 'max' },
    { label: 'Longest radio gap', get: (m) => m.longestOutageH, fmt: fmtDuration, best: 'min' },
    { label: 'Sun and Earth together', get: (m) => m.overlapPct, fmt: (v) => `${v.toFixed(1)}%`, best: 'max' },
  ];
  for (const line of lines) {
    const vals = ready.map((r) => line.get(r.res.summary));
    const best = line.best === 'max' ? Math.max(...vals) : Math.min(...vals);
    body.append(el('tr', {}, [el('th', { scope: 'row', text: line.label }),
      ...vals.map((v) => {
        const isBest = ready.length > 1 && Math.abs(v - best) < 1e-9;
        return el('td', { class: isBest ? 'best' : null }, isBest ? [el('span', { 'aria-label': 'best', text: '★ ' }), line.fmt(v)] : line.fmt(v));
      })]));
  }
}
