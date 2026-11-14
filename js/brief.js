// "Mission Brief": a clean one-page summary (white page, A4 portrait) of the selected
// site(s) — key numbers, timeline chart and honest limitations — that can be saved as a
// PNG or printed. Drawn on a canvas so the PNG and the print-out are identical.

import { getSite } from './sites.js';
import { getState, setState, DAY } from './state.js';
import { summarize, compositeScore, fmtDuration } from './metrics.js';
import { seriesJob } from './compute.js';
import { siteModel, horizonNote } from './model.js';
import { drawTimeline, timelineHeight } from './chart.js';
import { compareSlots } from './compare-view.js';
import { downloadBlob } from './export.js';
import { $, fmtDate, fmtLat, fmtLon } from './ui.js';

const W = 794, H = 1123, M = 40, SCALE = 2; // A4 at 96 dpi, drawn at double resolution
let kind = 'site';   // 'site' = the selected site, 'cmp' = the Compare slots
let drawnKey = '';
let requestRender = () => {};

export function openBrief(which) {
  kind = which;
  drawnKey = '';
  setState({ view: 'brief', playing: false });
}

export function initBrief(onChange) {
  requestRender = onChange;
  $('#brief-back').addEventListener('click', () => setState({ view: kind === 'cmp' ? 'compare' : 'timeline' }));
  $('#brief-print').addEventListener('click', () => window.print());
  $('#brief-png').addEventListener('click', () => $('#brief-canvas').toBlob((b) => { if (b) downloadBlob('mission-brief.png', b); }, 'image/png'));
}

/** Draws a timeline chart off-screen and returns its canvas (charts need a real size in the page). */
function chartCanvas(series, startMs, curves) {
  const c = document.createElement('canvas');
  c.style.cssText = `position:fixed;left:-10000px;top:0;width:${W - 2 * M - 20}px;height:${timelineHeight(curves)}px`;
  document.body.append(c);
  drawTimeline(c, { series, startMs, curves });
  c.remove();
  return c;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (const word of text.split(' ')) {
    if (ctx.measureText(`${line}${word}`).width > maxWidth && line) { ctx.fillText(line.trim(), x, y); y += lineHeight; line = ''; }
    line += `${word} `;
  }
  if (line.trim()) { ctx.fillText(line.trim(), x, y); y += lineHeight; }
  return y;
}

export async function renderBrief() {
  const s = getState();
  const slots = kind === 'cmp' ? compareSlots(s).filter(Boolean) : [{ id: s.site, start: s.rs }];
  const items = slots.map((slot) => {
    const site = getSite(slot.id, s.lat, s.lon);
    return { slot, site, model: siteModel(s, site, requestRender) };
  });
  const key = JSON.stringify([kind, items.map((i) => [i.site.id, i.slot.start, i.model.kind, i.model.lat, i.model.lon]), s.rd, s.emin, s.hm, s.hz, s.w]);
  if (key === drawnKey) return;
  drawnKey = key;
  $('#brief-status').textContent = 'Preparing the brief…';
  let results;
  try {
    results = await Promise.all(items.map((i) => seriesJob([i.model], i.slot.start, s.rd * 24, s.emin)));
  } catch { $('#brief-status').textContent = 'The brief could not be prepared. Please try again.'; drawnKey = ''; return; }
  if (key !== drawnKey) return; // something changed meanwhile

  const canvas = $('#brief-canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  // header
  ctx.fillStyle = '#0b1f4a';
  ctx.fillRect(0, 0, W, 78);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Mission Brief', M, 16);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Lunar Landing Site Navigator · Moon south pole · power and direct-to-Earth communication', M, 50);
  let y = 92;
  ctx.fillStyle = '#33415c';
  ctx.font = '12px system-ui, sans-serif';
  y = wrap(ctx, `Period: ${s.rd} days per site, hourly steps (UTC) · Earth counted in view from ${s.emin}° above the local horizon · `
    + `Score weights (sun, nights, Earth, gaps, both): ${s.w.join(' ')} · ${horizonNote(items[0].model)} Prepared ${fmtDate(Date.now())}.`, M, y, W - 2 * M, 16) + 12;

  // one block per site
  const single = items.length === 1;
  const summaryText = [];
  items.forEach((it, k) => {
    const series = results[k][0];
    const m = summarize(series);
    const score = compositeScore(m, s.w).score;
    summaryText.push(`${it.site.name}: score ${score.toFixed(0)}, sunlit ${m.sunlitPct.toFixed(0)}%, Earth visible ${m.earthPct.toFixed(0)}%`);
    ctx.fillStyle = '#0b1f4a';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${it.site.name}`, M, y);
    ctx.fillStyle = '#33415c';
    ctx.font = '12px system-ui, sans-serif';
    const where = `${fmtDate(it.slot.start)} – ${fmtDate(it.slot.start + s.rd * DAY)} · marker ${fmtLat(it.site.lat)}, ${fmtLon(it.site.lon)}`
      + `${it.site.approx ? ' (approximate)' : ''}${it.model.kind === 'terrain' ? ` · viewpoint ${Math.round(it.model.heightM).toLocaleString('en-US').replace('-', '−')} m` : ''}`;
    ctx.textAlign = 'right';
    ctx.fillText(where, W - M, y + 4);
    ctx.textAlign = 'left';
    y += 26;
    // the five key numbers + score
    const cells = [['Score', `${score.toFixed(0)} / 100`], ['Sunlit', `${m.sunlitPct.toFixed(1)}%`], ['Longest darkness', fmtDuration(m.longestDarkH)],
      ['Earth visible', `${m.earthPct.toFixed(1)}%`], ['Longest radio gap', fmtDuration(m.longestOutageH)], ['Both together', `${m.overlapPct.toFixed(1)}%`]];
    const cw = (W - 2 * M) / cells.length;
    cells.forEach(([label, value], i) => {
      ctx.fillStyle = i === 0 ? '#e7eefc' : '#f3f5f9';
      ctx.fillRect(M + i * cw + 2, y, cw - 4, 44);
      ctx.fillStyle = '#5a6880';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(label.toUpperCase(), M + i * cw + 8, y + 6);
      ctx.fillStyle = '#0b1f4a';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(value, M + i * cw + 8, y + 21);
    });
    y += 52;
    // timeline chart on a dark panel (the chart colours are designed for a dark background)
    const chart = chartCanvas(series, it.slot.start, single);
    const ch = timelineHeight(single);
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(M, y, W - 2 * M, ch + 12);
    ctx.drawImage(chart, M + 10, y + 6, W - 2 * M - 20, ch);
    y += ch + 12 + (single ? 16 : 12);
  });

  // legend + limitations
  ctx.fillStyle = '#33415c';
  ctx.font = '12px system-ui, sans-serif';
  y = wrap(ctx, 'Chart: yellow = some of the Sun in view (power), blue = Earth in view (direct radio link), green = both together, dark = neither.'
    + (single ? ' Curves: height of the Sun (yellow) and the Earth (blue) above the local horizon.' : ''), M, y, W - 2 * M, 16) + 8;
  ctx.fillStyle = '#0b1f4a';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('Honest limitations', M, y);
  y += 20;
  ctx.fillStyle = '#33415c';
  ctx.font = '11.5px system-ui, sans-serif';
  for (const line of [
    'Site markers are approximate: NASA announced named regions about 15 km across, not centre coordinates.',
    'Terrain comes from NASA LRO/LOLA elevation data on a 240 m grid (960 m for custom points); smaller features are not seen. The observer stands 2 m above the highest ground near the marker.',
    '“Earth visible” means the Earth is above the local horizon by the chosen margin; antennas, ground stations and signal strength are not modelled.',
    'One sample per hour: shorter events can be missed. Scores are a planning aid and ignore slopes, temperature, hazards and science value.',
  ]) y = wrap(ctx, `•  ${line}`, M, y, W - 2 * M, 15) + 2;

  // footer
  ctx.fillStyle = '#5a6880';
  ctx.font = '10.5px system-ui, sans-serif';
  wrap(ctx, 'Data: NASA LRO/LOLA (terrain), astronomy-engine + IAU rotation model (Sun, Earth, Moon). Checked against NASA JPL Horizons and NASA LOLA illumination maps. '
    + 'factifyedka.github.io/lunar-naviagator · NASA Space Apps Challenge 2026', M, H - 46, W - 2 * M, 14);

  canvas.setAttribute('aria-label', `Mission brief. ${summaryText.join('. ')}.`);
  $('#brief-status').textContent = y > H - 56 ? 'Note: with this many sites and this layout some text is tight; try fewer sites for a roomier page.' : '';
}
