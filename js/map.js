// South-pole map of the Moon, drawn on a canvas.
// Projection: polar stereographic centred on the south pole, 0° longitude (the side
// facing Earth) at the top and 90°E to the right — the usual layout of NASA polar maps.

import { SITES, FEATURES, CUSTOM_ID } from './sites.js';
import { COLORS, fitCanvas } from './ui.js';

const D2R = Math.PI / 180;
const KM_PER_DEG = 1737.4 * D2R;            // one degree of latitude on the Moon ≈ 30.3 km
export const ZOOMS = [-80, -84, -87.5];     // latitude at the edge of the map, per zoom level

const tanHalf = (lat) => Math.tan(((90 + lat) / 2) * D2R);

/**
 * createMap(canvas, { onSelect(id), onDrop(lat, lon) })
 * returns { draw(view) } where view = { zoom, site, custom:{lat,lon}|null, drop, light }
 * light (optional) = { sunLon, sunLat, earthLon } sub-solar / sub-Earth point in degrees.
 */
export function createMap(canvas, handlers) {
  let g = { cx: 0, cy: 0, R: 1, outer: ZOOMS[0] }; // geometry of the last drawing
  let lastView = null;

  const project = (lat, lon) => {
    const k = (tanHalf(lat) / tanHalf(g.outer)) * g.R;
    return [g.cx + k * Math.sin(lon * D2R), g.cy - k * Math.cos(lon * D2R)];
  };
  const unproject = (px, py) => {
    const dx = (px - g.cx) / g.R;
    const dy = -(py - g.cy) / g.R;
    const k = Math.hypot(dx, dy);
    if (k > 1) return null;
    return { lat: (2 * Math.atan(k * tanHalf(g.outer))) / D2R - 90, lon: Math.atan2(dx, dy) / D2R };
  };
  const inView = (lat) => lat <= g.outer + 1e-9;

  function draw(view) {
    lastView = view;
    const { ctx, w, h } = fitCanvas(canvas);
    const outer = ZOOMS[view.zoom] ?? ZOOMS[0];
    g = { cx: w / 2, cy: h / 2, R: Math.min(w, h) / 2 - 40, outer };
    ctx.clearRect(0, 0, w, h);

    // --- surface disc ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, 2 * Math.PI);
    ctx.clip();
    const surf = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.R);
    surf.addColorStop(0, '#5b6170');
    surf.addColorStop(1, '#474c59');
    ctx.fillStyle = surf;
    ctx.fillRect(0, 0, w, h);

    // --- craters (schematic circles) ---
    const pxPerDeg = g.R / (90 + outer);
    for (const f of FEATURES) {
      const [x, y] = project(f.lat, f.lon);
      const r = (f.d / 2 / KM_PER_DEG) * pxPerDeg;
      const bowl = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      bowl.addColorStop(0, 'rgba(22,25,34,0.75)');
      bowl.addColorStop(1, 'rgba(40,44,55,0.55)');
      ctx.fillStyle = bowl;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(190,198,215,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // --- day/night shading for a smooth sphere (no terrain shadows) ---
    if (view.light) {
      const ux = Math.sin(view.light.sunLon * D2R);
      const uy = -Math.cos(view.light.sunLon * D2R);   // unit vector on screen pointing to the Sun
      // The line where the Sun sits on the horizon is offset from the pole by the
      // sub-solar latitude (positive = Sun north of the equator = pole in darkness).
      const off = view.light.sunLat * pxPerDeg;
      const ox = g.cx + ux * off;
      const oy = g.cy + uy * off;
      const L = g.R * 2;
      const shade = ctx.createLinearGradient(ox - ux * L, oy - uy * L, ox + ux * L, oy + uy * L);
      shade.addColorStop(0, 'rgba(4,6,14,0.72)');
      shade.addColorStop(0.492, 'rgba(4,6,14,0.62)');
      shade.addColorStop(0.508, 'rgba(255,236,170,0.10)');
      shade.addColorStop(1, 'rgba(255,236,170,0.16)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
    }

    // --- graticule ---
    const stepLat = outer <= -86 ? 0.5 : outer <= -83 ? 1 : 2;
    ctx.lineWidth = 1;
    for (let lat = -90 + stepLat; lat < outer - 1e-6; lat += stepLat) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, (tanHalf(lat) / tanHalf(outer)) * g.R, 0, 2 * Math.PI); ctx.stroke();
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const [x, y] = project(outer, lon);
      ctx.strokeStyle = lon % 90 === 0 ? COLORS.gridStrong : COLORS.grid;
      ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(x, y); ctx.stroke();
    }
    // latitude labels along the 135°E line, crater names
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232,238,248,0.6)';
    for (let lat = -90 + stepLat; lat < outer - 1e-6; lat += stepLat) {
      const [x, y] = project(lat, 135);
      ctx.fillText(`${Math.abs(lat)}°S`, x + 3, y + 7);
    }
    ctx.textAlign = 'center';
    ctx.font = 'italic 11px system-ui, sans-serif';
    for (const f of FEATURES) {
      const r = (f.d / 2 / KM_PER_DEG) * pxPerDeg;
      if (r < 9) continue;
      const [x, y] = project(f.lat, f.lon);
      ctx.fillStyle = 'rgba(214,222,238,0.62)';
      ctx.fillText(f.name, x, y + r * 0.5);
    }
    ctx.restore();

    // --- rim and longitude labels ---
    ctx.strokeStyle = 'rgba(200,215,240,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 2 * Math.PI); ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let lon = 0; lon < 360; lon += 30) {
      const a = lon * D2R;
      const label = lon === 0 ? '0°' : lon === 180 ? '180°' : lon < 180 ? `${lon}°E` : `${360 - lon}°W`;
      ctx.fillText(label, g.cx + (g.R + 20) * Math.sin(a), g.cy - (g.R + 14) * Math.cos(a));
    }

    // --- arrows on the rim: where the Sun and the Earth are right now ---
    if (view.light) {
      rimBadge(ctx, view.light.sunLon, COLORS.sun, '#1a1400', 'Sun');
      rimBadge(ctx, view.light.earthLon, COLORS.earth, '#04121c', 'Earth');
    }

    // --- site markers ---
    const all = SITES.slice();
    if (view.custom) all.push({ id: CUSTOM_ID, name: 'Custom point', n: '★', lat: view.custom.lat, lon: view.custom.lon, group: 'custom' });
    let selected = null;
    for (const s of all) {
      if (!inView(s.lat)) continue;
      if (s.id === view.site) { selected = s; continue; }
      marker(ctx, s, false);
    }
    if (selected) marker(ctx, selected, true); // drawn last so it is on top
  }

  function rimBadge(ctx, lon, fill, ink, text) {
    const a = lon * D2R;
    const x = g.cx + (g.R + 1) * Math.sin(a);
    const y = g.cy - (g.R + 1) * Math.cos(a);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(8, 0); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill(); // arrow pointing outward
    ctx.restore();
    ctx.font = 'bold 11px system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 12;
    const bx = g.cx + (g.R - 16) * Math.sin(a);
    const by = g.cy - (g.R - 16) * Math.cos(a);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(bx - tw / 2, by - 9, tw, 18, 9); ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx, by + 0.5);
  }

  function marker(ctx, s, isSelected) {
    const [x, y] = project(s.lat, s.lon);
    const r = isSelected ? 14 : 11;
    const custom = s.group === 'custom';
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.fillStyle = custom ? COLORS.custom : s.group === 'artemis2024' ? '#F5F7FB' : '#1d2536';
    ctx.strokeStyle = custom ? '#ffffff' : s.group === 'artemis2024' ? '#0b0f1a' : '#F5F7FB';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = s.group === 'reference' ? '#F5F7FB' : '#0b0f1a';
    ctx.font = `bold ${isSelected ? 13 : 11}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(s.n), x, y + 0.5);
    if (isSelected) { // name tag
      ctx.font = 'bold 13px system-ui, sans-serif';
      const tw = ctx.measureText(s.name).width + 16;
      const w = canvas.clientWidth;
      const tx = Math.min(Math.max(x, tw / 2 + 4), w - tw / 2 - 4);
      const ty = y - r - 22 < 12 ? y + r + 22 : y - r - 22;
      ctx.fillStyle = 'rgba(8,11,20,0.92)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(tx - tw / 2, ty - 12, tw, 24, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(s.name, tx, ty + 0.5);
    }
  }

  // --- touch / mouse: tap a marker to select it, or drop a custom pin ---
  canvas.addEventListener('click', (ev) => {
    if (!lastView) return;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    if (lastView.drop) {
      const p = unproject(px, py);
      if (p) handlers.onDrop(p.lat, p.lon);
      return;
    }
    let best = null;
    let bestD = 26; // generous touch radius in pixels
    const all = SITES.slice();
    if (lastView.custom) all.push({ id: CUSTOM_ID, lat: lastView.custom.lat, lon: lastView.custom.lon });
    for (const s of all) {
      if (!inView(s.lat)) continue;
      const [x, y] = project(s.lat, s.lon);
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best) handlers.onSelect(best.id);
  });

  return { draw, redraw: () => lastView && draw(lastView) };
}
