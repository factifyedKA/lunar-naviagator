// The heavy jobs themselves. They run inside the Web Worker (js/worker.js); if a browser
// cannot start the worker, js/compute.js runs the very same code on the main thread.

import { computeSeries, findWindows } from './metrics.js';
import { makeDem, horizonMask } from './terrain.js';

const COARSE = { url: new URL('../data/dem_75s_960m.bin', import.meta.url), size: 953, mpp: 960 };
let demPromise = null;

/** Loads the 960 m LOLA elevation grid once (1.8 MB, int16 little-endian metres). */
function loadCoarseDem() {
  if (!demPromise) {
    demPromise = fetch(COARSE.url)
      .then((r) => { if (!r.ok) throw new Error('terrain file missing'); return r.arrayBuffer(); })
      .then((buf) => makeDem(new Int16Array(buf), COARSE.size, COARSE.mpp, 1));
    demPromise.catch(() => { demPromise = null; });
  }
  return demPromise;
}

export async function runJob(type, args) {
  if (type === 'series') {
    // Sun/Earth visibility for several sites over a date range
    const series = computeSeries(args.models, args.start, args.hours, args.emin);
    const transfer = series.flatMap((s) => [s.sunFrac.buffer, s.earthUp.buffer, s.sunH.buffer, s.earthH.buffer]);
    return { result: series, transfer };
  }
  if (type === 'windows') {
    // best-window finder: score every daily mission start for several sites
    const series = computeSeries(args.models, args.start, args.hours, args.emin);
    return { result: series.map((s) => findWindows(s, args.missionHours, args.weights)), transfer: [] };
  }
  if (type === 'mask') {
    // terrain horizon for a custom point, from the coarse elevation grid
    const dem = await loadCoarseDem();
    const { mask, height } = horizonMask(dem, args.lat, args.lon, { obsHeight: 2 });
    if (Number.isNaN(height)) throw new Error('point outside terrain model');
    return { result: { mask, height }, transfer: [mask.buffer] };
  }
  throw new Error(`unknown job ${type}`);
}
