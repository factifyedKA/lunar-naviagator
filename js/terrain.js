// Terrain: reading a NASA LRO/LOLA south-pole elevation model (DEM) and turning it into
// a "horizon mask" — for every compass direction, how high the real landscape (ridges,
// crater rims, mountains) rises above the ideal flat horizon as seen from a site.
//
// The DEM is a square grid in polar stereographic projection centred on the south pole
// (0° longitude towards the top, 90°E to the right), heights in metres relative to a
// 1737.4 km sphere. Pure maths, no browser code: used by Node tools, tests and the
// Web Worker.

const R = 1737400;             // reference radius in metres
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/**
 * Wrap a grid of heights.
 * @param data  Int16Array/Float32Array, row by row from the top
 * @param size  number of rows = number of columns
 * @param mpp   metres per pixel (at the pole)
 * @param unit  metres per data number (LOLA files store half-metres: 0.5)
 */
export function makeDem(data, size, mpp, unit = 1) {
  return { data, size, mpp, unit, c0: (size - 1) / 2 };
}

/** Grid position (column, row; may be fractional) of a latitude/longitude. */
export function demPixel(dem, latDeg, lonDeg) {
  const r = 2 * R * Math.tan(((90 + latDeg) / 2) * D2R);
  const lon = lonDeg * D2R;
  return [dem.c0 + (r * Math.sin(lon)) / dem.mpp, dem.c0 - (r * Math.cos(lon)) / dem.mpp];
}

/** Latitude/longitude of a grid position. */
export function demLatLon(dem, col, row) {
  const x = (col - dem.c0) * dem.mpp;
  const y = (dem.c0 - row) * dem.mpp;
  return { lat: (2 * Math.atan(Math.hypot(x, y) / (2 * R))) * R2D - 90, lon: Math.atan2(x, y) * R2D };
}

/** Height in metres at a latitude/longitude (bilinear interpolation); NaN outside the grid. */
export function demHeight(dem, latDeg, lonDeg) {
  const [c, r] = demPixel(dem, latDeg, lonDeg);
  const c0 = Math.floor(c);
  const r0 = Math.floor(r);
  if (c0 < 0 || r0 < 0 || c0 >= dem.size - 1 || r0 >= dem.size - 1) return NaN;
  const fc = c - c0;
  const fr = r - r0;
  const i = r0 * dem.size + c0;
  const d = dem.data;
  return ((d[i] * (1 - fc) + d[i + 1] * fc) * (1 - fr)
    + (d[i + dem.size] * (1 - fc) + d[i + dem.size + 1] * fc) * fr) * dem.unit;
}

/** The highest grid point within radiusKm of a position: { lat, lon, height }. */
export function highestNear(dem, latDeg, lonDeg, radiusKm) {
  const [c, r] = demPixel(dem, latDeg, lonDeg);
  const n = Math.ceil((radiusKm * 1000) / dem.mpp);
  let best = { col: Math.round(c), row: Math.round(r), h: -Infinity };
  for (let row = Math.round(r) - n; row <= Math.round(r) + n; row++) {
    for (let col = Math.round(c) - n; col <= Math.round(c) + n; col++) {
      if (row < 0 || col < 0 || row >= dem.size || col >= dem.size) continue;
      if (Math.hypot(col - c, row - r) > n) continue;
      const h = dem.data[row * dem.size + col] * dem.unit;
      if (h > best.h) best = { col, row, h };
    }
  }
  return { ...demLatLon(dem, best.col, best.row), height: best.h };
}

/**
 * Horizon mask: for each whole degree of azimuth (0 = north, 90 = east, clockwise) the
 * elevation angle in degrees of the highest terrain along that direction, as seen by an
 * observer standing obsHeight metres above the ground. Includes the Moon's curvature,
 * so on a peak the values go negative (the horizon dips), in a crater they are positive.
 * @returns { mask: Float32Array(360), height } — height = ground height at the site (m)
 */
export function horizonMask(dem, latDeg, lonDeg, { obsHeight = 2, maxKm = 300 } = {}) {
  const ground = demHeight(dem, latDeg, lonDeg);
  const r0 = R + ground + obsHeight;
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
  // local up / east / north in Moon-fixed x, y, z (same convention as js/astro.js)
  const up = [cl * co, cl * so, sl];
  const east = [-so, co, 0];
  const north = [-sl * co, -sl * so, cl];
  const mask = new Float32Array(360);
  const maxM = maxKm * 1000;
  for (let az = 0; az < 360; az++) {
    const ca = Math.cos(az * D2R);
    const sa = Math.sin(az * D2R);
    const u = [north[0] * ca + east[0] * sa, north[1] * ca + east[1] * sa, north[2] * ca + east[2] * sa];
    let best = -Infinity;
    for (let d = dem.mpp * 0.75; d <= maxM; d += Math.max(dem.mpp, d * 0.004)) {
      const th = d / R;                     // angle at the Moon's centre
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const qz = up[2] * ct + u[2] * st;
      const h = demHeight(dem, Math.asin(qz) * R2D,
        Math.atan2(up[1] * ct + u[1] * st, up[0] * ct + u[0] * st) * R2D);
      if (Number.isNaN(h)) break;           // walked off the edge of the model
      const r1 = R + h;
      const t = (r1 * ct - r0) / (r1 * st); // tangent of the elevation angle of that ground point
      if (t > best) best = t;
    }
    mask[az] = Math.atan(best) * R2D;
  }
  return { mask, height: ground };
}

/** Horizon elevation (degrees) at any azimuth, interpolated between whole degrees. */
export function maskAt(mask, azDeg) {
  const a = ((azDeg % 360) + 360) % 360;
  const i = Math.floor(a);
  const f = a - i;
  return mask[i % 360] * (1 - f) + mask[(i + 1) % 360] * f;
}
