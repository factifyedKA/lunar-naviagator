# PLAN — Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 · challenge "Lunar Landing Site Navigator".
Deadline: Sun 15 Nov 2026, 11:59 pm local.

## Goal
A static website (HTML + CSS + JavaScript, no backend, no login, no CDN) on GitHub Pages
that lets mission planners, educators and the public compare Moon south-pole landing
sites and dates by **where the Sun and the Earth are relative to the horizon**
(solar power potential and direct-to-Earth communication windows).

## Milestones
| # | Milestone | Status |
|---|-----------|--------|
| 1 | Polar site map, site list, custom point, shareable URL state | done |
| 2 | Sun/Earth calculations (real ephemeris + IAU Moon rotation), horizon view, time slider and time-lapse, automated tests | done |
| 3 | Real NASA LOLA terrain horizons + relief map, power and comms timeline, scores, composite score with weights, year simulation script, Web Worker | done |
| 4 | Compare 2–4 sites/dates, best-window finder | done |
| 5 | Learn mode (tour, glossary, Simple/Expert), CSV/PNG export, share link | done |
| 6 | Validation page, About page, polish, publish, SUBMISSION.md, DEMO.md | next |
| + | Extras if time remains: 3D Moon view, mission-day countdown | |

## How the code is organised
```
index.html          page shell (header, control panel, views)
css/style.css       dark, colour-blind-safe theme, responsive layout
js/app.js           starts the app, wires controls to views
js/state.js         one shared app state, saved in the URL (share by link)
js/sites.js         candidate landing regions and map features (data only)
js/astro.js         the science: Moon orientation, Sun/Earth elevation + azimuth
js/map.js           south-pole map (canvas)
js/horizon.js       horizon / sky panorama (canvas)
js/terrain.js       LOLA elevation grid -> terrain horizon mask
js/metrics.js       visibility over time, the five key numbers, composite score
js/model.js         loads data files, builds the site model (terrain or flat)
js/compute.js       sends heavy jobs to the Web Worker (js/worker.js, js/jobs.js)
js/chart.js         timeline chart (canvas)
js/timeline-view.js Timeline & scores view
js/compare-view.js  Compare view (up to four sites/dates)
js/finder-view.js   Best-window finder view
js/learn-view.js    Learn view: guided tour and glossary list
js/glossary.js      glossary words and tap-to-explain tooltips
js/export.js        CSV / PNG download and share-link helpers
data/               small files generated from NASA LOLA data + the year simulation
js/ui.js            small helpers (formatting, canvas sizing, colours)
vendor/             third-party library committed to the repo (astronomy-engine, MIT)
tests/              automated tests, run with `npm test`
tools/              Node scripts: build-terrain.mjs, simulate.mjs, browser-check.mjs
```

## Rules we follow
- Nothing invented. Every approximation is labelled in the app and in DECISIONS.md.
- Same science code runs in the browser, in the tests and in the simulation script.
- Tests run after every milestone; each milestone is one clear commit.
