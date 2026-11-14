// Landing-site data. Pure data: used by the browser app, the tests and the simulation.
// Longitudes are degrees east (negative = west). See DECISIONS.md for how sure we are
// of every coordinate. "approx: true" shows an "approximate" badge in the app.

export const GROUPS = [
  { id: 'artemis2024', title: 'Artemis III candidate regions', note: 'NASA, October 2024 list' },
  { id: 'reference', title: 'Earlier candidates and reference points', note: 'NASA 2022 list and LOLA study sites' },
];

export const SITES = [
  { id: 'cabeus-b', name: 'Peak near Cabeus B', lat: -84.3, lon: -62.0, group: 'artemis2024', approx: true,
    blurb: 'A peak near the crater Cabeus B, on the Earth-facing side of the pole.' },
  { id: 'haworth', name: 'Haworth', lat: -86.8, lon: -22.0, group: 'artemis2024', approx: true,
    blurb: 'High ground beside Haworth crater, whose floor never sees the Sun.' },
  { id: 'malapert', name: 'Malapert Massif', lat: -85.96, lon: -2.3, group: 'artemis2024', approx: true,
    blurb: 'A tall mountain on the Earth-facing side of the pole.' },
  { id: 'mouton-plateau', name: 'Mons Mouton Plateau', lat: -84.2, lon: 28.0, group: 'artemis2024', approx: true,
    blurb: 'Part of the broad, flat-topped mountain Mons Mouton.' },
  { id: 'mouton', name: 'Mons Mouton', lat: -85.4, lon: 31.7, group: 'artemis2024', approx: true,
    blurb: 'A wide, flat-topped mountain; once the planned landing area of NASA’s VIPER rover.' },
  { id: 'nobile-1', name: 'Nobile Rim 1', lat: -85.4, lon: 38.5, group: 'artemis2024', approx: true,
    blurb: 'On the western rim of Nobile crater.' },
  { id: 'nobile-2', name: 'Nobile Rim 2', lat: -84.0, lon: 58.7, group: 'artemis2024', approx: true,
    blurb: 'On the north-eastern rim of Nobile crater.' },
  { id: 'gerlache-2', name: 'de Gerlache Rim 2', lat: -88.2, lon: -64.0, group: 'artemis2024', approx: true,
    blurb: 'Near the rim of de Gerlache crater, close to the pole.' },
  { id: 'slater', name: 'Slater Plain', lat: -87.5, lon: 113.0, group: 'artemis2024', approx: true,
    blurb: 'A plain next to Slater crater, on the far side of the pole from Earth.' },

  { id: 'ridge', name: 'Connecting Ridge', lat: -89.45, lon: -137.31, group: 'reference', approx: true,
    blurb: 'The ridge linking Shackleton and de Gerlache craters; one of the best-lit places near the pole.' },
  { id: 'shackleton-peak', name: 'Peak near Shackleton', lat: -88.8, lon: 123.64, group: 'reference', approx: true,
    blurb: 'A high point a short distance from Shackleton crater.' },
  { id: 'shackleton-rim', name: 'Shackleton Rim', lat: -89.78, lon: -155.73, group: 'reference', approx: true,
    blurb: 'On the rim of Shackleton crater, which sits almost exactly at the pole.' },
  { id: 'pole', name: 'South Pole', lat: -90, lon: 0, group: 'reference', approx: false,
    blurb: 'The exact geographic south pole of the Moon, for reference.' },
];
SITES.forEach((s, i) => { s.n = i + 1; }); // the number shown on the map and in the list

// Named craters drawn as schematic circles for orientation (IAU Gazetteer, rounded).
// d = diameter in km.
export const FEATURES = [
  { name: 'Shackleton', lat: -89.67, lon: 129.78, d: 21 },
  { name: 'de Gerlache', lat: -88.5, lon: -87.1, d: 32 },
  { name: 'Sverdrup', lat: -88.5, lon: -152.0, d: 35 },
  { name: 'Shoemaker', lat: -88.1, lon: 44.9, d: 52 },
  { name: 'Faustini', lat: -87.3, lon: 77.0, d: 39 },
  { name: 'Haworth', lat: -87.45, lon: -5.17, d: 51 },
  { name: 'Slater', lat: -88.08, lon: 111.3, d: 25 },
  { name: 'Nobile', lat: -85.2, lon: 53.5, d: 73 },
  { name: 'Amundsen', lat: -84.5, lon: 82.8, d: 103 },
  { name: 'Malapert', lat: -84.9, lon: 12.9, d: 69 },
  { name: 'Cabeus', lat: -85.33, lon: -42.13, d: 100 },
  { name: 'Scott', lat: -82.1, lon: 48.5, d: 103 },
  { name: 'Wiechert', lat: -84.5, lon: 165.0, d: 41 },
  { name: 'Kocher', lat: -84.5, lon: -134.0, d: 24 },
];

export const CUSTOM_ID = 'custom';
export const LAT_MIN = -90;   // custom points must lie between these latitudes
export const LAT_MAX = -80;

/** Returns the site object for an id; for "custom" it builds one from lat/lon. */
export function getSite(id, customLat, customLon) {
  if (id === CUSTOM_ID) {
    return { id: CUSTOM_ID, name: 'Custom point', lat: customLat, lon: customLon, group: 'custom', approx: false,
      blurb: 'A point you placed yourself.', n: '★' };
  }
  return SITES.find((s) => s.id === id) || SITES[2];
}
