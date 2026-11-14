// Service worker: lets the app work offline and be added to the iPad home screen.
// Strategy: NETWORK FIRST. Whenever the device is online the newest files are fetched (and
// saved); the saved copies are used only when the network is unavailable. This way a new
// version of the site is never hidden by an old cache.
const CACHE = 'llsn-offline-v4';
const FILES = [
  "./",
  "index.html",
  "css/style.css",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "js/app.js",
  "js/astro.js",
  "js/brief.js",
  "js/chart.js",
  "js/compare-view.js",
  "js/compute.js",
  "js/export.js",
  "js/finder-view.js",
  "js/glossary.js",
  "js/horizon.js",
  "js/jobs.js",
  "js/learn-view.js",
  "js/map.js",
  "js/metrics.js",
  "js/model.js",
  "js/moon3d.js",
  "js/scenarios.js",
  "js/sites.js",
  "js/state.js",
  "js/team.js",
  "js/terrain.js",
  "js/timeline-view.js",
  "js/ui.js",
  "js/validation-view.js",
  "js/worker.js",
  "vendor/astronomy.js",
  "vendor/three.module.min.js",
  "data/dem_75s_960m.bin",
  "data/horizons.json",
  "data/relief_80s.png",
  "data/relief_global.png",
  "data/terrain.json",
  "data/validation-horizons.json",
  "data/validation-nasa-illumination.json",
  "data/year-sim.json"
];

self.addEventListener('install', (event) => {
  // save a copy of every file; a file that fails to download must not block the others
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(FILES.map((f) => cache.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
