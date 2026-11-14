// Scenario cards on the Explore page: one-tap questions that run the best-window finder
// across all listed sites and answer in one plain sentence.

import { SITES } from './sites.js';
import { getState, setState, DAY, HOUR, startOfUtcDay } from './state.js';
import { topWindows } from './metrics.js';
import { windowsJob } from './compute.js';
import { siteModel, modelKey } from './model.js';
import { $, el, fmtDate } from './ui.js';

const year = (y) => ({ start: Date.UTC(y, 0, 1), days: 365, label: `in ${y}` });
const SCENARIOS = [
  { id: 'week', question: 'Best 7-day landing window in 2027?', missionDays: 7, when: () => year(2027), noun: '7-day landing window' },
  { id: 'crew', question: 'Best site for a 30-day crewed stay in 2027?', missionDays: 30, when: () => year(2027), noun: '30-day stay' },
  { id: 'soon', question: 'Best 14-day window in the next 6 months?', missionDays: 14,
    when: () => ({ start: startOfUtcDay(Date.now()), days: 180, label: 'in the next 6 months' }), noun: '14-day window' },
];

let requestRender = () => {};
let active = null;            // id of the scenario whose answer is shown
const answers = new Map();    // key -> 'busy' | 'failed' | { text, go }

export function initScenarios(onChange) {
  requestRender = onChange;
  const box = $('#scenario-cards');
  for (const sc of SCENARIOS) {
    box.append(el('button', { type: 'button', class: 'btn scenario', 'data-scenario': sc.id, 'aria-pressed': 'false', text: sc.question,
      onclick: () => { active = active === sc.id ? null : sc.id; requestRender(); } }));
  }
  $('#scenario-open').addEventListener('click', () => {
    const a = active && answers.get(keyFor(SCENARIOS.find((x) => x.id === active)));
    if (a && a.go) setState({ ...a.go, view: 'finder', playing: false });
  });
}

function keyFor(sc) {
  const s = getState();
  const w = sc.when();
  return `${sc.id}|${w.start}|${s.hm}|${s.hz}|${s.emin}|${s.w.join()}`;
}

function run(sc, key) {
  const s = getState();
  const w = sc.when();
  answers.set(key, 'busy');
  const models = SITES.map((site) => siteModel(s, site, requestRender));
  if (models.some((m) => m.kind === 'unavailable')) { answers.delete(key); return; } // terrain not loaded yet: try again on the next draw
  windowsJob(models, w.start, w.days * 24, s.emin, sc.missionDays * 24, s.w).then((lists) => {
    const all = lists.flatMap((wins, i) => wins.map((x) => ({ ...x, site: SITES[i] })));
    const best = topWindows(all, 1, sc.missionDays * 24, (x) => x.site.id)[0];
    // other sites whose own best window scores (almost) the same
    const tied = lists.map((wins, i) => ({ site: SITES[i], top: Math.max(...wins.map((x) => x.score)) }))
      .filter((x) => x.site.id !== best.site.id && best.score - x.top < 0.5).map((x) => x.site.name);
    const startMs = w.start + best.start * HOUR;
    answers.set(key, {
      text: `Best ${sc.noun} ${w.label}: ${best.site.name}, landing on ${fmtDate(startMs)}. `
        + `For those ${sc.missionDays} days the Sun is in view ${best.summary.sunlitPct.toFixed(0)}% of the time and the Earth ${best.summary.earthPct.toFixed(0)}% `
        + `(score ${best.score.toFixed(0)} out of 100).`
        + (tied.length ? ` Equally good at their best dates: ${tied.slice(0, 4).join(', ')}${tied.length > 4 ? ' and others' : ''}.` : ''),
      go: { rs: w.start, fd: w.days >= 365 ? 365 : 180, ml: sc.missionDays, sc: 'all' },
    });
  }, () => answers.set(key, 'failed')).then(requestRender);
}

export function renderScenarios() {
  for (const b of document.querySelectorAll('.scenario')) b.setAttribute('aria-pressed', String(b.dataset.scenario === active));
  const box = $('#scenario-answer');
  box.hidden = !active;
  if (!active) return;
  const sc = SCENARIOS.find((x) => x.id === active);
  const key = keyFor(sc);
  if (!answers.has(key)) run(sc, key);
  const a = answers.get(key);
  const ready = a && typeof a === 'object';
  $('#scenario-text').textContent = ready ? a.text : a === 'failed' ? 'This could not be calculated just now. Please try again.' : 'Checking every start date at every site…';
  $('#scenario-open').hidden = !ready;
}
