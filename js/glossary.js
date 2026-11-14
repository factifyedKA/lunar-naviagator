// Glossary: plain-language meanings of the technical words used in the app, and the
// code that turns those words into tappable tooltips.

export const GLOSSARY = [
  { term: 'Horizon', match: ['horizon'], text: 'The line where the ground meets the sky. Anything below it is hidden by the ground.' },
  { term: 'Elevation', match: ['elevation'], text: 'How high something is in the sky, measured in degrees up from the horizon. 0° is on the horizon, 90° is straight overhead.' },
  { term: 'Two ways to measure height', match: [], text: '“Above the local horizon” is measured from the real skyline in that direction, so it decides whether you can actually see the Sun or the Earth. “Elevation above a flat surface” ignores hills and crater rims, as if the Moon were perfectly smooth.' },
  { term: 'Azimuth', match: ['azimuth'], text: 'The compass direction of something in the sky, in degrees: 0° is north, 90° east, 180° south, 270° west.' },
  { term: 'Degree (°)', match: [], text: 'A unit for angles. Your fist held at arm’s length covers about 10°. The Sun and the Earth, seen from the Moon, are about 0.5° and 2° wide.' },
  { term: 'Libration', match: ['libration'], text: 'A slow monthly wobble of the Moon as seen from Earth. It makes the Earth drift up and down and side to side in the Moon’s sky.' },
  { term: 'Permanently shadowed region', match: ['permanently shadowed'], text: 'A crater floor near a pole that sunlight never reaches. These places are extremely cold and may hold water ice.' },
  { term: 'Direct-to-Earth link', match: ['direct-to-Earth', 'direct radio link'], text: 'Radio contact straight between the lander and antennas on Earth, with no relay satellite. It only works while the Earth is above the horizon.' },
  { term: 'Terrain', match: ['real terrain', 'terrain'], text: 'The real shape of the ground: mountains, ridges and crater rims. Near the pole it decides where sunlight and radio signals can reach.' },
  { term: 'Horizon mask', match: ['horizon mask'], text: 'A list that says how high the real landscape rises above the ideal horizon in every compass direction around a site.' },
  { term: 'LRO', match: ['LRO'], text: 'Lunar Reconnaissance Orbiter, a NASA spacecraft that has mapped the Moon since 2009.' },
  { term: 'LOLA', match: ['LOLA'], text: 'Lunar Orbiter Laser Altimeter, the instrument on LRO that measured the Moon’s heights with laser pulses. Our terrain comes from it.' },
  { term: 'UTC', match: ['UTC'], text: 'Coordinated Universal Time, the world’s standard clock (the time in Greenwich, without summer time). Space missions use it.' },
  { term: 'Lunar day', match: ['lunar day'], text: 'One full cycle of day and night on the Moon: about 29.5 Earth days.' },
  { term: 'Eclipse', match: ['eclipse'], text: 'When the Earth moves in front of the Sun as seen from the Moon. People on Earth see a lunar eclipse at the same moment.' },
  { term: 'Sunlit %', match: ['sunlit'], text: 'The average share of the Sun’s disc that is above the local horizon over a period. 100% means full Sun all the time.' },
  { term: 'Overall score', match: ['overall score'], text: 'A single mark from 0 to 100 that mixes sunlight and Earth contact using weights you choose. The app shows exactly how it is worked out.' },
  { term: 'Weight', match: ['weights'], text: 'How much one part of the score counts. A weight of 0 ignores that part; 5 makes it very important.' },
  { term: 'Artemis', match: ['Artemis'], text: 'NASA’s programme to return astronauts to the Moon. Artemis III plans to land near the south pole.' },
  { term: 'Ephemeris', match: ['ephemeris'], text: 'A precise table or formula giving the positions of the Sun, Earth and Moon at any time.' },
  { term: 'Shaded relief', match: ['shaded relief'], text: 'A picture of the landscape made from height data by pretending a lamp shines on it from one side.' },
];

// longest phrases first, so "horizon mask" wins over "horizon"
const PATTERNS = GLOSSARY.flatMap((g) => g.match.map((m) => ({ m, g }))).sort((a, b) => b.m.length - a.m.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REGEX = new RegExp(`\\b(${PATTERNS.map((p) => esc(p.m)).join('|')})\\b`, 'i');
const lookup = (word) => PATTERNS.find((p) => p.m.toLowerCase() === word.toLowerCase()).g;

/**
 * Wraps the first mention of each glossary word inside `root` in a tappable button.
 * Skips text already inside buttons, links, headings-in-buttons, form controls and canvases.
 */
export function glossarize(root) {
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('button, a, select, option, input, textarea, canvas, summary, .term, [data-no-gloss]')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (let node of nodes) {
    for (let guard = 0; guard < 12; guard++) {
      const hit = REGEX.exec(node.nodeValue);
      if (!hit) break;
      const g = lookup(hit[1]);
      const after = node.splitText(hit.index + hit[1].length); // text after the word
      if (!seen.has(g.term)) {
        seen.add(g.term);
        const word = node.splitText(hit.index);                 // the word itself
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'term';
        btn.dataset.term = g.term;
        btn.textContent = word.nodeValue;
        word.replaceWith(btn);
      }
      node = after;
    }
  }
}

/** One shared tooltip, shown when a glossary word is tapped, hovered or focused. */
export function initGlossaryTooltips() {
  const pop = document.createElement('div');
  pop.id = 'term-pop';
  pop.className = 'term-pop';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  document.body.append(pop);
  let current = null;
  let shownAt = 0;

  const show = (btn) => {
    const g = GLOSSARY.find((x) => x.term === btn.dataset.term);
    if (!g) return;
    current = btn;
    shownAt = Date.now();
    pop.textContent = '';
    const b = document.createElement('strong');
    b.textContent = `${g.term}: `;
    pop.append(b, g.text);
    pop.hidden = false;
    btn.setAttribute('aria-describedby', 'term-pop');
    const r = btn.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 16);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight;
    pop.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - 8 - pop.offsetHeight)}px`;
  };
  const hide = () => {
    if (current) current.removeAttribute('aria-describedby');
    current = null;
    pop.hidden = true;
  };
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.term');
    // (a tap first focuses the word, which already opens the tooltip — do not close it again at once)
    if (!btn) hide();
    else if (current === btn && Date.now() - shownAt > 400) hide();
    else show(btn);
  });
  document.addEventListener('focusin', (ev) => { const b = ev.target.closest && ev.target.closest('.term'); if (b) show(b); });
  document.addEventListener('focusout', (ev) => { if (ev.target.closest && ev.target.closest('.term')) hide(); });
  document.addEventListener('mouseover', (ev) => { const b = ev.target.closest('.term'); if (b) show(b); });
  document.addEventListener('mouseout', (ev) => { if (ev.target.closest('.term') && document.activeElement !== current) hide(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);
}
