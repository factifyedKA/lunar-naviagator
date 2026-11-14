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
| 3 | Power and comms timeline, scores, composite score with weights, year simulation script + Web Worker | next |
| 4 | Compare 2–4 sites/dates, best-window finder | |
| 5 | Learn mode (tour, glossary, Simple/Expert), CSV/PNG export | |
| 6 | Validation page, About page, polish, publish, SUBMISSION.md, DEMO.md | |
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
js/ui.js            small helpers (formatting, canvas sizing, colours)
vendor/             third-party library committed to the repo (astronomy-engine, MIT)
tests/              automated tests, run with `npm test`
tools/              Node scripts (year simulation — milestone 3)
```

## Rules we follow
- Nothing invented. Every approximation is labelled in the app and in DECISIONS.md.
- Same science code runs in the browser, in the tests and in the simulation script.
- Tests run after every milestone; each milestone is one clear commit.
