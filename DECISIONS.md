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
