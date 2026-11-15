# SUBMISSION — ready-to-paste texts

NASA Space Apps Challenge 2026 · Challenge: **Lunar Landing Site Navigator**
Team: **--pathfinder--** · Member: **Kartik Agarwal**

- Live project: https://factifyedka.github.io/lunar-naviagator/
- Code: https://github.com/factifyedKA/lunar-naviagator

> Before pasting: open the live link once to
> confirm it loads without a login.

---

## Project Name
**Lunar Landing Site Navigator**

Tagline: *Find the light. Keep the link.*

---

## High-Level Summary (about 100 words)
Landing near the Moon's south pole means chasing sunlight that only skims the horizon and
an Earth that keeps dipping out of view. Lunar Landing Site Navigator is a free web tool
that shows, for any Artemis candidate region or any point you tap, where the Sun and the
Earth sit against the real terrain skyline, when there is power, when there is a direct
radio link, and when both happen together. It scores and compares sites, finds the best
landing window for your mission length, shows it all on a 3D Moon, and explains everything
in plain language. It runs in any browser, even offline on a tablet, and checks itself live
against NASA reference data.

---

## Detailed Project Description

### What it does
Lunar Landing Site Navigator turns a hard mission-planning question — *where and when
should we land near the Moon's south pole?* — into something anyone can explore in seconds.

- **Explore.** A south-pole relief map shows NASA's nine Artemis III candidate regions plus
  reference points. Tap a site, or drop your own pin, and a 360° horizon view shows the Sun
  and the Earth against the real terrain skyline, with plain sentences such as "Sun is 4.0°
  above the horizon" and a countdown ("Sunlight continues for another 3 d 4 h"). A time
  slider and time-lapse (1 hour or 1 day per second) show how they move. "Quick question"
  cards answer things like "Best 7-day landing window in 2027?" in one sentence.
- **Timeline & scores.** For 30 days up to one year, coloured strips show when the site has
  sunlight (power), when the Earth is in view (direct-to-Earth communication) and when both
  overlap. Five key numbers follow: sunlit %, longest darkness, Earth-visible %, longest
  radio gap and overlap %. An overall score from 0 to 100 uses weights the user sets with
  sliders, and a "Why this score?" table shows exactly how every point was earned.
- **Compare.** Up to four sites, or the same site on different dates, side by side with the
  same charts and numbers; the best value in each row is starred.
- **Best window.** Enter a mission length (for example 7, 14 or 30 days). The tool scores
  every possible start date for one site or for all sites and ranks the best landing
  windows.
- **3D Moon.** A globe you can turn and zoom with your fingers, textured with NASA LOLA
  relief, with the sites as tappable pins, the Sun as the light source and the Earth in its
  true direction, driven by the same time slider and Play button.
- **Learn.** A six-step guided tour explains why the south pole is special, why shadows are
  so long, what permanently shadowed regions are and why the Earth is only sometimes in
  view. Every technical word can be tapped for a plain-language explanation, and a
  Simple / Expert switch hides or shows the detailed controls. A printable classroom
  worksheet gives teachers four ready-made questions.
- **Validation.** 22 automated checks run live in the browser and compare the tool with
  NASA JPL Horizons, NASA's LOLA illumination maps and known physics, each with pass/fail,
  under a plain-words headline of the largest differences found.
- **Export and share.** Every chart saves as PNG, every table as CSV, and the full state
  of any view is stored in the link, so a finding can be shared with one tap. A one-page
  **Mission Brief** (key numbers, timeline, honest limitations) can be saved or printed.
- **Offline.** After one visit the tool works without a network and can be added to a
  tablet's home screen.

### How it works
1. **Ephemeris.** Sun and Moon positions come from the open-source astronomy-engine
   library.
2. **Moon orientation.** The Moon's pole, spin and libration follow the IAU rotation model;
   from these we build Moon-fixed axes and, for any latitude and longitude, the local
   up/east/north directions.
3. **Sun and Earth in the local sky.** We compute elevation and azimuth of both bodies from
   the site, including the Earth's parallax, the apparent size of each disc and eclipses by
   the Earth.
4. **Real terrain.** From NASA's LRO/LOLA 240 m elevation model we ray-march a horizon mask
   for each site: the height of the real skyline in 360 directions on a curved Moon. The
   Sun's visible disc fraction and the Earth's visibility are measured against that skyline.
   Custom points get the same treatment in the browser from a 960 m version of the model.
5. **Metrics.** Stepping hourly through the chosen period gives the timelines, the five
   key numbers, the composite score and the best-window ranking. Heavy calculations run in a
   Web Worker so the interface never freezes. A Node script pre-computes a full-year
   simulation of every site for the instant ranking table.

### How we know it is right
- Sun and Earth positions agree with **NASA JPL Horizons** to 0.007° or better in 110
  comparisons (five surface points, 2026–2028).
- Sunlight and Earth-visibility percentages agree with **NASA's LOLA 18.6-year
  illumination maps** at our twelve terrain viewpoints: 2.8 percentage points average
  difference for sunlight and 1.9 for Earth visibility (one year compared with 18.6 years).
- The model reproduces **permanently shadowed regions**: the floors of Shackleton, Haworth,
  Faustini and Shoemaker craters receive 0% sunlight, as in NASA's map.
- It reproduces the **total lunar eclipse of 3 March 2026** (the Earth hides the Sun as
  seen from the Moon), the libration limits and the 29.53-day lunar day.
- 32 automated Node tests and a headless-browser click-through of every feature (including
  an offline run) pass with no console errors.

### Benefits
- **Mission planners** get a fast first look at power and communication trade-offs before
  opening heavyweight tools, and can export the numbers.
- **Educators and students** get a hands-on way to see why the lunar south pole is unlike
  anywhere on Earth.
- **The public** can follow Artemis site selection with a tool that explains itself.
- It is honest: every approximation is labelled on screen, and the tool tests itself
  against NASA data in front of the user.

### Honest limitations
Candidate-region markers are approximate (NASA announced named regions about 15 km across,
not centre coordinates). Terrain is on a 240 m grid, so small features are not seen. The
radio link means "Earth above the local horizon by a chosen margin", not a full link
budget. Scores are a planning aid and ignore slopes, temperature and landing hazards. On the
3D Moon the relief away from the pole is coarse, the day/night shading is for a smooth ball,
and the Earth and Sun markers show direction only.

### Tools and technologies
HTML, CSS and JavaScript (ES modules) with no framework and no build step; HTML canvas for
all maps and charts; a Web Worker for calculations; Node.js for the terrain pre-processing,
the year simulation and the automated tests; Playwright for headless-browser testing;
GitHub Pages for hosting; a service worker and web manifest for offline use. Two third-party
libraries, both MIT-licensed and stored in the repository so the site makes no external
requests: astronomy-engine (ephemeris) and Three.js (3D Moon tab only).

---

## Use of Artificial Intelligence
Claude, an AI model made by Anthropic, was used to help write the code, the automated
tests and the documentation of this project. I made the decisions, tested the tool and
checked the results. No AI-generated images, audio or video are used. The numbers
shown in the tool do not come from an AI: they are computed from NASA data and published
models, and the Validation page compares them with NASA reference values every time it is
opened. The simple diagrams in the Learn tour, the app icon and the 3D Moon texture were
produced by code written for this project (the texture from NASA elevation data), not by an
image generator. Every
assumption and approximation is recorded in DECISIONS.md and on the About page.

---

## NASA Data
- **LRO / LOLA polar elevation model `LDEM_75S_240M`** (data set LRO-L-LOLA-4-GDR-V1.0,
  LOLA team, NASA Goddard Space Flight Center, NASA PDS Geosciences Node). *How we use it:*
  it is the terrain. We compute a 360-direction horizon mask for every site from it, a
  960 m version for user-placed points, and the shaded-relief background of the map.
  https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- **LRO / LOLA global elevation model `LDEM_4`** (4 pixels per degree, LOLA team, NASA PDS
  Geosciences Node). *How we use it:* we compute the whole-Moon shaded relief shown on the
  3D Moon tab from it.
- **LOLA average solar illumination and Earth visibility maps
  `AVGVISIB_65S_240M_201608` and `..._EARTH`** (LOLA team, NASA PDS, described at NASA
  Goddard PGDA). *How we use them:* as independent reference values; the Validation page
  compares our sunlight and Earth-visibility percentages with them site by site, and
  confirms the permanently shadowed crater floors. https://pgda.gsfc.nasa.gov/products/69
- **NASA JPL Horizons System.** *How we use it:* 110 reference azimuth/elevation values of
  the Sun and the Earth seen from points on the Moon, used on the Validation page and in
  the automated tests. https://ssd.jpl.nasa.gov/horizons/
- **NASA Artemis III candidate landing regions** (NASA news releases of 19 August 2022 and
  28 October 2024). *How we use them:* the list and names of the regions on the map.
  Marker positions are our own approximate placements and are labelled as such.

---

## Space Agency Partner Data and Other References
No partner-agency datasets are used directly in the tool.

Other tools, models and references:
- Astronomy Engine v2.1.19 by Don Cross (MIT licence): Sun and Moon ephemerides and the
  IAU lunar rotation series. https://github.com/cosinekitty/astronomy
- Three.js r160 (MIT licence): rendering of the 3D Moon tab. https://threejs.org
- Archinal, B. A., et al. (2011). Report of the IAU Working Group on Cartographic
  Coordinates and Rotational Elements: 2009. *Celestial Mechanics and Dynamical Astronomy*,
  109, 101–135.
- Mazarico, E., et al. (2011). Illumination conditions of the lunar polar regions using
  LOLA topography. *Icarus*, 211, 1066–1081.
- Smith, D. E., et al. (2010). The Lunar Orbiter Laser Altimeter investigation on the Lunar
  Reconnaissance Orbiter mission. *Space Science Reviews*, 150, 209–241.
- Giorgini, J. D., et al. (1996). JPL's On-Line Solar System Data Service. *Bulletin of the
  American Astronomical Society*, 28, 1158.
- IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology): crater names.
- Okabe, M. and Ito, K. Color Universal Design palette (colour-blind-safe colours).
- Claude (Anthropic): AI assistance with code, tests and documentation.
- Playwright and Node.js: testing and data preparation.
