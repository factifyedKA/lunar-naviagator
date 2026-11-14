# Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 — challenge "Lunar Landing Site Navigator".

A static web app (no backend, no login, no CDN) that lets anyone compare landing sites near
the Moon's south pole by showing where the Sun and the Earth are relative to the horizon —
for solar power potential and direct-to-Earth communication windows.

- Open `index.html` through any static web server (or GitHub Pages).
- Run the automated tests: `npm test` (Node 20+; no install needed).
- Run the headless-browser click-through: `node tools/browser-check.mjs` (needs Playwright).

See [PLAN.md](PLAN.md) for the roadmap and [DECISIONS.md](DECISIONS.md) for every choice,
approximation and data source.
