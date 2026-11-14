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

## Milestone 6 — validation, About, countdown
- **Validation runs live in the browser** (22 checks) and the same references are tested
  in Node (`tests/validation.test.js`).
  1. *JPL Horizons:* 110 Sun/Earth azimuth-elevation values for five surface points,
     2026-12-01 to 2028-12-01 every 73 days (`tools/fetch-horizons.mjs` →
     `data/validation-horizons.json`). Largest difference: 0.007° azimuth (on the sky),
     0.003° elevation. Pass limit 0.05°.
  2. *Known physics:* independent libration model, libration limits, sub-solar latitude,
     polar Sun limit, synodic month, total lunar eclipse of 3 March 2026.
  3. *NASA LOLA illumination maps* (`AVGVISIB_65S_240M_201608[_EARTH]`, 18.6-year hourly
     averages at the surface): values read at our 12 terrain viewpoints with HTTP range
     requests (`tools/fetch-nasa-illumination.mjs` → `data/validation-nasa-illumination.json`).
     Our 2027 results differ by 2.8 points on average for sunlight (worst 7.7) and 1.9 for
     Earth visibility (worst 4.9). Pass limit 10 points, because we compare one year with
     18.6 years and a 2 m mast with the bare surface. For this comparison only, the Earth
     counts as visible while any part of its disc shows (centre ≥ −0.95°), to match NASA's
     definition. The exact South Pole is excluded: it lies on the corner of four map pixels.
     The map label says CENTER_LONGITUDE = 180, but the grid is laid out like the elevation
     maps (0° up); this was confirmed with crater floors (0%) and ridges (~90%).
  4. *Permanently shadowed regions:* four crater floors are 0% sunlit in NASA's map and in
     our 2027 calculation.
- **Countdown extra:** the "sky right now" card says how long the sunlight / Earth contact
  lasts or when it returns (looks ahead up to 60 days, to the minute). Not shown during
  time-lapse because it is too costly per animation frame.
- **3D Moon view:** not built — the time was better spent on real terrain and validation.
- **Team name on the About page** comes from `js/team.js`; placeholders in square brackets
  are not displayed.
- **Publishing:** the build machine cannot switch on GitHub Pages; the owner does this in
  the repository settings (steps in README.md).

## After first user test — "too complicated"
The owner opened the live site and found the first screen overwhelming. Simple mode (the
default) was cut down:
- A welcome card on a fresh visit says what the tool is for in two sentences, gives three
  steps and three big buttons (explore, best place to land, short tour).
- (Superseded, see "Consistency fix" below: tabs and site list are no longer reduced.)
- Explore keeps only Play, Now and the slider; day-stepping, speed choice, typed date,
  coordinates and PNG buttons are Expert. Time-lapse default is now 1 day per second.
- A one-line verdict ("Power and radio contact right now") heads the read-outs.
- Captions are shorter in Simple mode but still state what is simplified or approximate.
- The score explanation table and weight sliders are Expert; Simple shows the score, its
  strongest and weakest part, and a pointer to Expert.
- Bug fixed: a background redraw could wipe a typed latitude while typing the longitude.

## Consistency fix after owner review
- **Compare and Validation tabs are always visible** (they had been moved to Expert only in
  the simplification, which made them hard to find). All seven tabs show in both modes.
- **The site list always shows all 13 sites**, the same 13 that are numbered on the map,
  ranked in the whole-year table and searched by the best-window finder. Simple mode still
  hides only the coordinates. A test now checks that the list, the terrain file and the
  year-simulation file cover exactly the same sites.

## Enhancement round
- **Safety:** tag `v1-safe` marks commit e56fcb2. GitHub refused the tag upload from the
  build session (only the working branch may be pushed), so the tag is local; the commit
  itself is in the branch history on GitHub and can be restored from there.
- **Two angles in the read-out:** "above the local horizon (terrain)" decides visibility;
  "elevation above a flat surface" ignores terrain. Both are always shown, with an ⓘ tooltip.
- **Scenario cards (Explore):** three one-tap questions. Each runs the same best-window
  finder over all 13 sites with the current settings and weights; the answer names the
  best site and date and lists other sites that are equally good at their own best dates
  (ties at 100 are common in polar summer). "2027" = 1 Jan – 31 Dec 2027.
- **Mission Brief:** one A4 page drawn on a canvas (so PNG and print are identical), opened
  from Timeline & scores (one site) or Compare (up to four). White page; charts keep their
  dark panel because the colours are designed for it. Always prints the limitations.
- **Validation headline:** computed live from the same checks, never typed in by hand.
- **Classroom worksheet:** four questions; the teacher's key for question 2 is filled from
  the real year simulation, the other notes are qualitative.
- **First-visit intro:** on a fresh visit (no shared link) the Explore view plays about
  seven seconds of time-lapse at 1 day per second, then returns to the present. Any tap
  or key press stops it at once. Skipped when the device asks for reduced motion. The
  intro note keeps its space when it disappears so that buttons never move under a finger
  (a real tap-miss bug found by the browser test).
- **Offline / home screen:** `sw.js` is a network-first service worker: online it always
  fetches the newest files and saves a copy; the copies are used only when offline, so a
  new deployment is never hidden by an old cache. `manifest.webmanifest` and the icons
  (drawn by `tools/make-icons.mjs`) make the site installable from Share → Add to Home
  Screen. A test checks that every app file is on the offline list.
- **Touch targets:** small buttons raised to 40 px, info buttons to 36 px.

## 3D Moon tab
- **Library:** Three.js r160 (MIT), single file `vendor/three.module.min.js`, loaded only
  when the 3D tab is first opened (dynamic import) so other tabs stay fast.
- **Surface texture is real NASA data, not illustrative:** `data/relief_global.png` is
  shaded relief computed by `tools/build-global-relief.mjs` from the NASA LOLA global
  elevation model `LDEM_4` (4 pixels per degree, about 7.6 km per pixel; slopes exaggerated
  9x so relief is visible at that scale). South of 80°S the sharper 240 m polar relief is
  blended in by the shader. Both carry artificial upper-left lighting, as labelled.
- **Lighting:** the Sun is the light direction from the same ephemeris as everywhere else,
  on a smooth sphere, with the night side kept at 30% so it stays visible (labelled).
- **Earth and Sun balls** show true directions at 1.4 Moon radii; sizes and distances are
  not to scale (labelled).
- **Controls:** our own small orbit code (free rotation with no pole lock): drag, pinch,
  wheel, double-tap reset, arrow keys, +/−, Home, P. Pins are real HTML buttons over the
  canvas, so they are tappable and keyboard-accessible; a text line describes the scene.
- **Fallback:** if WebGL cannot start or the graphics context is lost, a friendly message
  points to the Explore tab; the text description still works.
- **Bugs found while testing:** share links rejected tab names containing a digit
  (`moon3d`) — fixed and tested; the first drag speed spun the pole out of sight — slowed
  so the surface follows the finger.
- **Not verified on a physical iPad:** pinch-zoom is implemented with standard pointer
  events but could only be tested with mouse, wheel and keyboard in the headless browser.
