// THE SCIENCE: where are the Sun and the Earth in the sky of a point on the Moon?
//
// Steps (all vectors are in the J2000 equatorial frame, "EQJ"):
//  1. Ephemeris: geocentric Moon and Sun positions from astronomy-engine
//     (verified by its author against NASA JPL Horizons).
//  2. Moon orientation: IAU WGCCRE rotation model — direction of the Moon's north pole
//     (RA, Dec) and prime-meridian angle W, including the periodic libration terms
//     (Archinal et al., "Report of the IAU Working Group on Cartographic Coordinates and
//     Rotational Elements"), as returned by Astronomy.RotationAxis(Body.Moon).
//  3. From pole + W we build the Moon-fixed axes x (0° longitude, towards mean Earth),
//     y (90°E) and z (north pole).
//  4. For a site (latitude, longitude) we build local Up / East / North directions and
//     measure the Sun's and Earth's elevation above the horizon and azimuth
//     (clockwise from north).
//
// This file has no browser code, so Node tests and the simulation use it unchanged.

import * as Astronomy from '../vendor/astronomy.js';

export const MOON_RADIUS_KM = 1737.4;   // IAU mean radius
export const SUN_RADIUS_KM = 695700;
export const EARTH_RADIUS_KM = 6371.0;
const AU_KM = 149597870.7;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);

/**
 * Everything that depends only on the time (not on the site): the Moon-fixed axes and
 * the vectors from the Moon's centre to the Earth and to the Sun, in km.
 * Compute this once per time step, then call skyAt() for as many sites as you like.
 */
export function moonFrame(date) {
  const time = Astronomy.MakeTime(date instanceof Date ? date : new Date(date));
  const axis = Astronomy.RotationAxis(Astronomy.Body.Moon, time);
  const ra = axis.ra * 15 * D2R;  // library gives right ascension in hours
  const dec = axis.dec * D2R;
  const w = axis.spin * D2R;       // prime-meridian angle W

  const z = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]; // north pole
  const node = [-Math.sin(ra), Math.cos(ra), 0];  // where the Moon's equator crosses the J2000 equator
  const m = cross(z, node);                        // 90° further east along the Moon's equator
  const x = [0, 1, 2].map((i) => node[i] * Math.cos(w) + m[i] * Math.sin(w)); // prime meridian
  const y = cross(z, x);

  const gm = Astronomy.GeoMoon(time);                                  // Earth -> Moon (AU)
  const gs = Astronomy.GeoVector(Astronomy.Body.Sun, time, false);     // Earth -> Sun (AU)
  const toEarth = [-gm.x * AU_KM, -gm.y * AU_KM, -gm.z * AU_KM];
  const toSun = [(gs.x - gm.x) * AU_KM, (gs.y - gm.y) * AU_KM, (gs.z - gm.z) * AU_KM];
  return { x, y, z, toEarth, toSun };
}

/** Latitude/longitude (degrees) of the point on the Moon directly under a direction. */
function subPoint(frame, v) {
  const n = norm(v);
  return {
    lat: Math.asin(dot(v, frame.z) / n) * R2D,
    lon: Math.atan2(dot(v, frame.y), dot(v, frame.x)) * R2D,
  };
}
export const subEarthPoint = (frame) => subPoint(frame, frame.toEarth);
export const subSolarPoint = (frame) => subPoint(frame, frame.toSun);

/**
 * Sun and Earth as seen from a site on the Moon.
 * @param frame   result of moonFrame()
 * @param latDeg  latitude (south negative)
 * @param lonDeg  longitude (east positive)
 * @param heightKm optional height of the site above the 1737.4 km sphere
 * @returns { sun: {el, az, radius, distKm}, earth: {...} } angles in degrees.
 *   el = elevation of the centre above the ideal flat horizon, az = clockwise from north,
 *   radius = apparent angular radius of the disc.
 */
export function skyAt(frame, latDeg, lonDeg, heightKm = 0) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
  const { x, y, z } = frame;
  const up = [0, 1, 2].map((i) => cl * co * x[i] + cl * so * y[i] + sl * z[i]);
  const east = [0, 1, 2].map((i) => -so * x[i] + co * y[i]);
  const north = [0, 1, 2].map((i) => -sl * co * x[i] - sl * so * y[i] + cl * z[i]);
  const r = MOON_RADIUS_KM + heightKm;

  const look = (target, bodyRadiusKm) => {
    const d = [target[0] - r * up[0], target[1] - r * up[1], target[2] - r * up[2]]; // site -> body
    const dist = norm(d);
    return {
      el: Math.asin(Math.max(-1, Math.min(1, dot(d, up) / dist))) * R2D,
      az: (Math.atan2(dot(d, east), dot(d, north)) * R2D + 360) % 360,
      radius: Math.asin(bodyRadiusKm / dist) * R2D,
      distKm: dist,
    };
  };
  return { sun: look(frame.toSun, SUN_RADIUS_KM), earth: look(frame.toEarth, EARTH_RADIUS_KM) };
}

/**
 * Angle in degrees between the centres of the Sun and the Earth in a site's sky.
 * If it is smaller than the Earth's radius plus the Sun's radius, the Earth is covering
 * (part of) the Sun: an eclipse seen from the Moon.
 */
export function sunEarthSkySeparation(sky) {
  const a = sky.sun, b = sky.earth;
  const c = Math.sin(a.el * D2R) * Math.sin(b.el * D2R)
    + Math.cos(a.el * D2R) * Math.cos(b.el * D2R) * Math.cos((a.az - b.az) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
}

/** Convenience: sky at one site and one time. */
export const skyAtTime = (date, latDeg, lonDeg, heightKm = 0) => skyAt(moonFrame(date), latDeg, lonDeg, heightKm);

/**
 * Fraction (0..1) of a round disc that is above a straight horizon.
 * @param heightAboveHorizon elevation of the disc centre minus the horizon height (deg)
 * @param radius             angular radius of the disc (deg)
 */
export function discFractionVisible(heightAboveHorizon, radius) {
  const d = heightAboveHorizon / radius;
  if (d >= 1) return 1;
  if (d <= -1) return 0;
  return 0.5 + (d * Math.sqrt(1 - d * d) + Math.asin(d)) / Math.PI;
}

/**
 * Azimuth (degrees) of the Earth's average position as seen from a site: the direction
 * of the Moon's 0° longitude / 0° latitude axis. Used to centre the horizon panorama.
 */
export function meanEarthAzimuth(latDeg, lonDeg) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  const e = -Math.sin(lon);                    // east component of the +x axis
  const n = -Math.sin(lat) * Math.cos(lon);    // north component of the +x axis
  if (Math.hypot(e, n) < 1e-9) return 0;
  return (Math.atan2(e, n) * R2D + 360) % 360;
}

/** Angle in degrees between the Sun and the Earth as seen from the Moon's centre. */
export function sunEarthSeparation(frame) {
  return Math.acos(dot(frame.toSun, frame.toEarth) / (norm(frame.toSun) * norm(frame.toEarth))) * R2D;
}
