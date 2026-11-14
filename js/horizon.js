// Horizon view: an unrolled 360° panorama of the sky as seen from the landing site.
// Left-right = compass direction (azimuth), up-down = height above the horizon
// (elevation). Near the pole the Sun and Earth stay within a few degrees of the horizon,
// so the vertical scale is stretched to make small angles easy to see.

import { COLORS, fitCanvas, fmtSigned } from './ui.js';
import { maskAt } from './terrain.js';

const PAD = { left: 46, right: 12, top: 12, bottom: 34 };
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * createSky(canvas) -> { draw(model) }
 * model = {
 *   lat,                 site latitude (sets the vertical range)
 *   hz,                  local horizon height in degrees (flat horizon)
 *   mask,                360 terrain-horizon elevations (real terrain) or null for flat
 *   centerAz,            azimuth shown in the middle of the panorama
 *   sun, earth,          { el, az, radius } now
 *   trail: { sun: [[az, el], ...], earth: [...] }   hourly positions over the slider window
 * }
 * draw() returns { stretch } = how many times the vertical scale is exaggerated.
 */
export function createSky(canvas) {
  function draw(m) {
    const { ctx, w, h } = fitCanvas(canvas);
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    // vertical range: enough for the Earth's highest possible position at this latitude
    // (and for the terrain silhouette, up to a sensible limit)
    let elMax = Math.ceil(90 - Math.abs(m.lat) + 9);
    if (m.mask) elMax = Math.max(elMax, Math.ceil(Math.min(24, Math.max(...m.mask) + 2)));
    const horizonAt = (az) => (m.mask ? maskAt(m.mask, az) : m.hz);
    const elMin = -elMax;
    const X = (az) => PAD.left + ((((az - m.centerAz + 540) % 360) + 360) % 360) / 360 * plotW;
    const Y = (el) => PAD.top + ((elMax - el) / (elMax - elMin)) * plotH;
    const pxPerDeg = plotH / (elMax - elMin);

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.left, PAD.top, plotW, plotH); ctx.clip();

    // sky
    const sky = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    sky.addColorStop(0, '#04060d');
    sky.addColorStop(1, '#0c1326');
    ctx.fillStyle = sky;
    ctx.fillRect(PAD.left, PAD.top, plotW, plotH);

    // elevation grid lines
    const step = elMax > 20 ? 5 : 2;
    ctx.lineWidth = 1;
    for (let e = Math.ceil(elMin / step) * step; e <= elMax; e += step) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(PAD.left, Y(e)); ctx.lineTo(PAD.left + plotW, Y(e)); ctx.stroke();
    }
    // azimuth grid lines every 45°
    for (let a = 0; a < 360; a += 45) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(X(a), PAD.top); ctx.lineTo(X(a), PAD.top + plotH); ctx.stroke();
    }

    // paths over the 30-day window (drawn before the ground so the ground dims the hidden part)
    drawTrail(ctx, m.trail.sun, X, Y, plotW, COLORS.sun);
    drawTrail(ctx, m.trail.earth, X, Y, plotW, COLORS.earth);

    // ground: everything below the local horizon (semi-transparent so hidden bodies show faintly)
    const base = PAD.top + plotH;
    const ground = ctx.createLinearGradient(0, Y(Math.min(elMax, 6)), 0, base);
    ground.addColorStop(0, 'rgba(128,134,148,0.84)');
    ground.addColorStop(1, 'rgba(58,62,74,0.88)');
    ctx.beginPath();
    ctx.moveTo(PAD.left, base);
    for (let px = 0; px <= plotW; px += 2) {
      ctx.lineTo(PAD.left + px, Y(horizonAt(m.centerAz - 180 + (px / plotW) * 360)));
    }
    ctx.lineTo(PAD.left + plotW, base);
    ctx.closePath();
    ctx.fillStyle = ground;
    ctx.fill();
    ctx.beginPath();
    for (let px = 0; px <= plotW; px += 2) {
      const y = Y(horizonAt(m.centerAz - 180 + (px / plotW) * 360));
      if (px === 0) ctx.moveTo(PAD.left, y); else ctx.lineTo(PAD.left + px, y);
    }
    ctx.strokeStyle = '#E8EEF8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(232,238,248,0.9)';
    ctx.fillText(m.mask ? 'Ground — real terrain skyline (NASA LOLA)' : m.hz === 0 ? 'Ground (flat horizon)' : `Ground (flat horizon raised to ${fmtSigned(m.hz)})`, PAD.left + 8, base - 6);
    if (m.mask || m.hz !== 0) { // show where the ideal 0° horizon is
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(232,238,248,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, Y(0)); ctx.lineTo(PAD.left + plotW, Y(0)); ctx.stroke();
      ctx.setLineDash([]);
    }

    // the Sun, then the Earth on top (during an eclipse the Earth really is in front).
    // Labels go on opposite sides so they never cover each other.
    body(ctx, X(m.sun.az), Y(m.sun.el), Math.max(5, m.sun.radius * pxPerDeg), m.sun.el - horizonAt(m.sun.az), 'Sun', COLORS.sun, PAD.left, plotW, true);
    body(ctx, X(m.earth.az), Y(m.earth.el), Math.max(7, m.earth.radius * pxPerDeg), m.earth.el - horizonAt(m.earth.az), 'Earth', COLORS.earth, PAD.left, plotW, false);
    ctx.restore();

    // axes labels
    ctx.fillStyle = COLORS.dim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let e = Math.ceil(elMin / step) * step; e <= elMax; e += step) {
      if (Y(e) < PAD.top + 6 || Y(e) > PAD.top + plotH - 4) continue;
      ctx.fillText(e === 0 ? '0°' : fmtSigned(e, 0), PAD.left - 6, Y(e));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let a = 0; a < 360; a += 45) {
      const x = X(a);
      if (x < PAD.left + 14 || x > PAD.left + plotW - 14) continue;
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(COMPASS_8[a / 45], x, PAD.top + plotH + 4);
      ctx.fillStyle = COLORS.dim;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`${a}°`, x, PAD.top + plotH + 19);
    }
    ctx.strokeStyle = 'rgba(200,215,240,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD.left + 0.5, PAD.top + 0.5, plotW - 1, plotH - 1);

    return { stretch: pxPerDeg / (plotW / 360) };
  }

  function drawTrail(ctx, pts, X, Y, plotW, color) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    let px = null;
    for (const [az, el] of pts) {
      const x = X(az);
      const y = Y(el);
      if (px === null || Math.abs(x - px) > plotW / 2) ctx.moveTo(x, y); else ctx.lineTo(x, y); // break at the wrap-around
      px = x;
    }
    ctx.stroke();
    ctx.restore();
  }

  function body(ctx, x, y, r, aboveHorizon, name, color, left, plotW, preferRight) {
    const visible = aboveHorizon > 0;
    ctx.save();
    if (visible) {
      const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r + 16);
      glow.addColorStop(0, `${color}88`);
      glow.addColorStop(1, `${color}00`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, r + 16, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else { // below the horizon: hollow dashed outline
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.setLineDash([]);
    }
    // label with a dark backing so it stays readable on sky and ground
    const text = `${name} ${fmtSigned(aboveHorizon)}`;
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 12;
    const fitsRight = x + r + 10 + tw < left + plotW;
    const fitsLeft = x - r - 10 - tw > left;
    const onRight = preferRight ? fitsRight || !fitsLeft : !fitsLeft;
    const tx = onRight ? x + r + 8 : x - r - 8 - tw;
    ctx.fillStyle = 'rgba(6,9,18,0.82)';
    ctx.beginPath(); ctx.roundRect(tx, y - 11, tw, 22, 6); ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, tx + 6, y + 0.5);
    ctx.restore();
  }

  return { draw };
}
