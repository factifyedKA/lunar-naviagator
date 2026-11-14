// Loads the pre-computed data files and builds the "site model" (observer position +
// horizon) that all calculations use, for the horizon mode chosen by the user.

import { CUSTOM_ID } from './sites.js';
import { maskJob } from './compute.js';

export const data = {
  horizons: null,  // data/horizons.json — terrain horizon masks for the listed sites
  yearSim: null,   // data/year-sim.json — full-year results for the ranking table
  relief: null,    // shaded-relief image for the map
};

async function getJson(path) {
  const r = await fetch(new URL(`../data/${path}`, import.meta.url));
  if (!r.ok) throw new Error(`could not load ${path}`);
  return r.json();
}

/** Loads the small data files. Resolves to false if the terrain data is unavailable. */
export async function loadData(onImage) {
  const img = new Image();
  img.onload = () => { data.relief = img; onImage(); };
  img.src = new URL('../data/relief_80s.png', import.meta.url).href;
  const [h, y] = await Promise.allSettled([getJson('horizons.json'), getJson('year-sim.json')]);
  if (h.status === 'fulfilled') data.horizons = h.value;
  if (y.status === 'fulfilled') data.yearSim = y.value;
  return Boolean(data.horizons);
}

const customMasks = new Map(); // "lat,lon" -> 'pending' | 'failed' | { mask, height }

/**
 * Site model for the current settings.
 * kind: 'terrain' (real LOLA horizon), 'flat' (flat horizon at hz°),
 *       'pending' (custom point, terrain still being calculated — flat for now),
 *       'unavailable' (terrain could not be loaded — flat).
 * @param onReady called when a pending custom-point horizon has arrived
 */
export function siteModel(state, site, onReady) {
  const flat = (kind) => ({ kind, lat: site.lat, lon: site.lon, heightKm: 0, mask: null, hz: kind === 'flat' ? state.hz : 0 });
  if (state.hm === 'flat') return flat('flat');
  if (site.id === CUSTOM_ID) {
    const key = `${site.lat},${site.lon}`;
    const m = customMasks.get(key);
    if (m && typeof m === 'object') {
      return { kind: 'terrain', coarse: true, lat: site.lat, lon: site.lon, heightKm: m.height / 1000, heightM: m.height, mask: m.mask, hz: 0 };
    }
    if (m === 'failed') return flat('unavailable');
    if (!m) {
      customMasks.set(key, 'pending');
      maskJob(site.lat, site.lon)
        .then((res) => customMasks.set(key, res), () => customMasks.set(key, 'failed'))
        .then(onReady);
    }
    return flat('pending');
  }
  const h = data.horizons && data.horizons.sites[site.id];
  if (!h) return flat('unavailable');
  return { kind: 'terrain', coarse: false, lat: h.lat, lon: h.lon, heightKm: h.height / 1000, heightM: h.height, mask: h.mask, hz: 0 };
}

/** A short text key that changes whenever the model's numbers change (for caching). */
export function modelKey(m) {
  return `${m.kind}|${m.lat}|${m.lon}|${m.heightKm}|${m.hz}|${m.coarse ? 'c' : 'f'}`;
}

/** Plain-English description of the horizon used, for captions. */
export function horizonNote(m) {
  if (m.kind === 'terrain' && m.coarse) return 'Horizon: real terrain from NASA LOLA elevation data (960 m grid).';
  if (m.kind === 'terrain') return 'Horizon: real terrain from NASA LOLA elevation data (240 m grid).';
  if (m.kind === 'pending') return 'Calculating the terrain horizon for your point… (flat horizon shown meanwhile).';
  if (m.kind === 'unavailable') return 'Terrain data is not available here, so a flat horizon is used (simplification).';
  return 'Horizon: flat-ground simplification — real hills and crater rims are ignored.';
}
