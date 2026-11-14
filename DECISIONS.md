# DECISIONS

Choices made while building, with the reason. Newest sections are added at the bottom.

## Technology
- **Plain HTML/CSS/JavaScript ES modules, no build step.** GitHub Pages can serve it as-is
  and a beginner can read every file.
- **astronomy-engine v2.1.19 (MIT)** is vendored in `vendor/astronomy.js`. It supplies the
  Sun and Moon ephemerides (its results are verified by its author against NASA JPL
  Horizons / NOVAS) and the IAU Moon rotation model. No CDN is used.
- **Charts and maps are drawn by our own canvas code** (no chart library): fewer files,
  full control over accessibility colours, easy PNG export.
- **Colours:** Okabe–Ito colour-blind-safe palette. Sun = yellow, Earth = sky blue,
  both = bluish green, warning = vermilion. Status is always given in words/icons too.

## Science
- **Moon orientation:** IAU WGCCRE lunar pole and prime-meridian series (the one in the
  "Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements"),
  as implemented by `Astronomy.RotationAxis(Body.Moon)`. We build the Moon-fixed axes from
  the pole (RA, Dec) and the prime-meridian angle W ourselves in `js/astro.js`.
  The IAU series follows the Moon's mean-Earth/polar-axis frame to roughly 0.005°
  (about 150 m on the surface).
- **Sun/Earth direction:** geocentric Moon and Sun vectors (J2000 equator) from
  astronomy-engine; we subtract the site position so the Earth's parallax (up to 0.26°)
  is included. Light-travel-time effects left out are below 0.01°.
- **Moon shape:** a sphere of radius 1737.4 km (IAU mean radius).
- **Terrain — SIMPLIFICATION:** the network of this build machine blocks all NASA/USGS
  servers (see "Network" below), so no LRO/LOLA elevation data could be downloaded.
  The app therefore uses a **flat horizon** with an adjustable "local horizon height"
  (−3° to +5°). Negative values imitate standing on a peak (the horizon dips),
  positive values imitate surrounding hills. This is labelled on screen and in About.
  Real terrain horizon masks are the first upgrade if NASA data becomes reachable.
- **Region of interest:** 80°S–90°S. Custom points are limited to this cap.
- **Times are UTC** everywhere.

## Landing-site coordinates (IMPORTANT — honesty note)
NASA announced the candidate regions as named ~15 km × 15 km areas on a map; the news
releases do not give centre coordinates, and NASA/USGS servers could not be reached from
this build machine to read the published grids. **Every marker is therefore labelled
"approximate" in the app** except the geographic South Pole.

Names (certain, from NASA releases):
- Oct 2024 list of nine Artemis III candidate regions: Peak near Cabeus B, Haworth,
  Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2,
  de Gerlache Rim 2, Slater Plain.
- Aug 2022 list (thirteen regions) included Connecting Ridge and Peak near Shackleton.

Marker positions used, and how sure we are:
| Site | Lat, Lon (E+) | Basis | Confidence |
|------|---------------|-------|------------|
| Malapert Massif | −85.96, −2.3 | value quoted in published site studies | good (±0.2°) |
| Mons Mouton | −85.4, 31.7 | close to former VIPER landing area | good (±0.3°) |
| Connecting Ridge | −89.45, −137.31 | LOLA "Site 01" high-illumination point | good |
| Peak near Shackleton | −88.80, 123.64 | LOLA "Site 07" | good |
| Shackleton Rim (reference) | −89.78, −155.73 | LOLA "Site 04" | good |
| Haworth | −86.8, −22.0 | placed from NASA region map | fair (±0.5°) |
| Nobile Rim 1 | −85.4, 38.5 | west rim of Nobile crater | fair (±0.5°) |
| Nobile Rim 2 | −84.0, 58.7 | north-east rim of Nobile crater | fair (±0.5°) |
| de Gerlache Rim 2 | −88.2, −64.0 | near de Gerlache rim | fair (±0.5°) |
| Peak near Cabeus B | −84.3, −62.0 | placed from NASA region map | **unsure (±1°)** |
| Mons Mouton Plateau | −84.2, 28.0 | placed from NASA region map | **unsure (±1°)** |
| Slater Plain | −87.5, 113.0 | next to Slater crater | **unsure (±1°)** |

To do when NASA/USGS servers are reachable: replace these with centres from the USGS data
release "Down-selected Artemis III Candidate Landing Site Navigational Grids" (Dec 2024).

Crater outlines on the map are **schematic circles** (centre + diameter rounded from the
IAU Gazetteer of Planetary Nomenclature) for orientation only. They are not imagery.

## Network (what could and could not be fetched)
- Reachable: npm registry, GitHub.
- Blocked: nasa.gov, ssd.jpl.nasa.gov (JPL Horizons), pgda.gsfc.nasa.gov and
  pds-geosciences (LOLA data), usgs.gov, Wikimedia.
- Consequences: flat-horizon model instead of LOLA terrain; no photo basemap; validation
  uses independent physical checks (libration model cross-check, eclipse timing, known
  limits) instead of a JPL Horizons table, until access is granted.

## Interface
- One "Explore" view holds the map, the live Sun/Earth read-outs and the horizon view
  together, so picking a site instantly updates the sky.
- The horizon view is an unrolled 360° panorama with a stretched vertical scale, because
  near the pole the Sun and Earth never climb more than a few degrees.
- The panorama is centred on the average direction of the Earth for the chosen site, so
  the Earth is always near the middle.
- Sites are numbered on the map; the same numbers are in the list (avoids label clutter).
- The time slider covers a 30-day window (about one lunar day) in 1-hour steps.
- "Sun in view" uses the visible fraction of the Sun's disc, not just its centre.

## Milestone 2 additions
- **Eclipses:** when the Earth's disc overlaps the Sun's disc in the site's sky (a lunar
  eclipse seen from the Moon) the app says so instead of reporting full Sun.
- **Drawing order / sizes in the horizon view:** discs are drawn at true scale when that
  is big enough to see and tap, otherwise slightly enlarged (Sun ≥ 5 px, Earth ≥ 7 px
  radius). This is stated in About.
- **Time-lapse** pauses automatically when the browser tab is hidden, and the URL is not
  rewritten on every animation frame (Safari limits how often that may happen).
- **Tests added (16 total):** cross-check of our IAU-based sub-Earth point against the
  library's independent libration model (< 0.05°), libration limits, sub-solar latitude
  limit (±1.6°), polar Sun/Earth elevation limits, synodic-month azimuth cycle, phase
  angle, and the total lunar eclipse of 3 March 2026 (Earth must cover the Sun).
- **Speed:** a full year, hourly, for all 13 sites takes about 0.3 s in Node, so the
  milestone 3 timelines can be computed live as well as pre-computed.

## Milestone 3 — NASA data became reachable (supersedes the "Terrain" and "Network" notes above)
After the owner approved network access to five NASA/USGS hosts, the flat-horizon
fallback was replaced by real terrain. Flat mode is kept as a clearly labelled option.

- **Elevation data:** `LDEM_75S_240M.IMG` (LRO LOLA gridded data record, data set
  LRO-L-LOLA-4-GDR-V1.0, NASA PDS Geosciences Node; 240 m/pixel polar stereographic,
  75°S–90°S). The 29 MB original is not committed; `tools/build-terrain.mjs` turns it into
  the small files in `data/`. Orientation was verified against known craters
  (Shackleton floor −2.8 km, Malapert Massif +5.0 km, Cabeus −3.7 km).
- **Horizon masks (`data/horizons.json`):** for each listed site, the terrain elevation
  angle in 360 directions, ray-marched out to 300 km over the 240 m grid on a curved Moon.
- **Where the observer stands:** 2 m above the **highest ground within 5 km of the
  marker** for the Artemis regions (they are ~15 km across and planners favour high
  ground), within 1 km for the LOLA study points, and exactly at the South Pole. The
  viewpoint's coordinates and height are shown on the site card.
- **Custom points:** horizon computed in the browser (Web Worker) from the same model
  averaged to 960 m (`data/dem_75s_960m.bin`, 1.8 MB, loaded only when needed). Coarser,
  and labelled as such.
- **Peak near Cabeus B marker moved** from (−84.3, −62.0) to (−83.6, −68.6): the LOLA
  model shows the only real peak in that area there (+4.6 km). Still labelled approximate.
- **Map background:** shaded relief computed from the LOLA grid with artificial lighting
  from the upper left (labelled). Day/night overlay is still for a smooth sphere.
- **Definitions of the five key numbers**
  - Sunlit % = average fraction of the Sun's disc above the local horizon (the measure
    used in NASA illumination studies), reduced during eclipses by the Earth.
  - Longest darkness = longest stretch with less than 0.1% of the disc in view.
  - Earth visible % = time the Earth's centre is at least the chosen margin above the
    local horizon. Longest radio gap = longest stretch without that.
  - Both % = time with any Sun and an Earth link together.
- **Composite score** = weighted average of five 0–100 marks: the three percentages as
  they are; for longest darkness and longest radio gap 0 h = 100 and ≥ 15 days = 0
  (15 days ≈ a full lunar night). Default weights 3, 2, 2, 1, 2. The app shows the full
  breakdown table ("Why this score?").
- **Time step:** 1 hour everywhere. The Sun moves about 0.5° per hour along the horizon.
- **Year simulation:** `tools/simulate.mjs` → `data/year-sim.json` (2027, hourly, all
  sites, terrain and flat). Results agree with published LOLA illumination work: the
  Connecting Ridge and Shackleton rim points come out about 92% and 87% sunlit, and
  Malapert Massif sees the Earth 100% of the time. (Exact literature values to be quoted
  on the Validation page after checking the source.)
- **First JPL Horizons spot check:** Sun from Malapert Massif marker, 2026-11-20 06:00 UTC:
  Horizons az 53.015°, el 3.979°; ours az 53.019°, el 3.978°.
- **Network:** now reachable: ssd.jpl.nasa.gov, pgda.gsfc.nasa.gov,
  pds-geosciences.wustl.edu, planetarynames.wr.usgs.gov, www.nasa.gov. Still not
  reachable: the USGS data release with the official region grids.

## Milestone 4 — compare and best-window finder
- **Compare:** four slots (A–D), each a site plus its own start date, so the same site can
  be compared on different dates. All slots share one length and the same horizon model,
  Earth margin and score weights, so the comparison is fair. Best value per row gets a ★
  (not colour alone).
- **Best-window finder:** tries one mission start per day (00:00 UTC) across the search
  period, scores each with the same composite score as everywhere else, and lists the ten
  best. Windows of the same site in the list never overlap; different sites may share dates.
  Mission length 1–60 days; search period 90, 180 or 365 days. Runs in the Web Worker.

## Milestone 5 — learn mode, Simple/Expert, export and share
- **Simple is the default.** It hides azimuth/elevation numbers, typed coordinates, the
  horizon-model switch, the radio margin and the elevation curves. Expert shows everything.
  The choice is kept in the share link (`m=x`). Honesty labels stay visible in both modes.
- **Guided tour:** six short steps; every step has a "Show me" button that opens the real
  tool in a prepared state (for example the floor of Shackleton crater, which our terrain
  model reports as 0% sunlit for the whole of 2027 — a permanently shadowed region).
- **Glossary tooltips** are added automatically to the first mention of each term in hints,
  captions, notes and the About text; tap, hover or keyboard focus opens them.
- **Diagrams** in the tour are simple drawings made for this project (no external images,
  no people).
- **CSV files** start with `#` comment lines that record the site, viewpoint, horizon
  model and settings, so an exported file explains itself.
- **PNG files** are composed on the dark background with a title and a data-credit line.
- **Share link** copies the URL (which holds the full state); if the browser refuses
  clipboard access it opens the system share sheet instead.
