// "Learn" view: a short guided tour in plain language for students and the public,
// each step with a "Show me" button that opens the real tool, plus the glossary.

import { getState, setState } from './state.js';
import { GLOSSARY } from './glossary.js';
import { $, el } from './ui.js';

// Small hand-drawn diagrams (static, written by us). Colours follow the app palette.
const SVG = {
  tilt: `<svg viewBox="0 0 320 140" role="img" aria-label="Sunlight arrives almost exactly side-on at the Moon's poles">
    <circle cx="36" cy="70" r="22" fill="#F0E442"/><text x="36" y="112" text-anchor="middle">Sun</text>
    <g stroke="#F0E442" stroke-width="2"><path d="M70 30H190"/><path d="M70 70H178"/><path d="M70 110H190"/></g>
    <circle cx="232" cy="70" r="46" fill="#8b93a5"/><path d="M229 14L235 126" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="244" y="14">axis tilted only 1.5°</text><text x="232" y="138" text-anchor="middle">south pole: Sun on the horizon</text></svg>`,
  shadow: `<svg viewBox="0 0 320 140" role="img" aria-label="A low Sun makes a small hill cast a very long shadow">
    <circle cx="26" cy="78" r="14" fill="#F0E442"/><path d="M42 80L300 104" stroke="#F0E442" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M0 108H320V140H0Z" fill="#6f7686"/><path d="M92 108L128 70L164 108Z" fill="#9aa1b1"/>
    <path d="M128 70L164 108H312L310 104Z" fill="#0b0f1a" opacity="0.85"/>
    <rect x="122" y="60" width="12" height="10" fill="#009E73"/><text x="128" y="52" text-anchor="middle">lit peak</text>
    <rect x="228" y="98" width="12" height="10" fill="#D55E00"/><text x="234" y="90" text-anchor="middle">in shadow</text></svg>`,
  psr: `<svg viewBox="0 0 320 140" role="img" aria-label="Sunlight skims over a crater and never reaches its floor">
    <circle cx="26" cy="46" r="14" fill="#F0E442"/><path d="M42 48L310 66" stroke="#F0E442" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M0 62H90Q110 62 120 90Q160 128 200 90Q210 62 230 62H320V140H0Z" fill="#6f7686"/>
    <path d="M112 74Q160 128 208 74Q200 62 190 66Q160 112 128 64Z" fill="#0b0f1a" opacity="0.9"/>
    <text x="160" y="104" text-anchor="middle" fill="#56B4E9">ice?</text><text x="160" y="134" text-anchor="middle">never sunlit</text></svg>`,
  earth: `<svg viewBox="0 0 320 140" role="img" aria-label="The Earth bobs slowly above and below the horizon">
    <path d="M0 84H320V140H0Z" fill="#6f7686"/><path d="M0 84H320" stroke="#fff" stroke-width="2"/>
    <circle cx="160" cy="52" r="20" fill="#56B4E9" stroke="#fff" stroke-width="2"/>
    <circle cx="160" cy="108" r="20" fill="none" stroke="#56B4E9" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="M204 40V120M198 48L204 38L210 48M198 112L204 122L210 112" stroke="#fff" stroke-width="2" fill="none"/>
    <text x="216" y="56">in view: radio link</text><text x="216" y="112">hidden: silence</text><text x="20" y="78">horizon</text></svg>`,
};

function tour(s) {
  return [
    { title: 'Why go to the Moon’s south pole?',
      text: ['The south pole has two things explorers want close together: mountain tops that are sunlit most of the time, for solar power — and deep craters that are always dark and very cold, where water ice may be hiding.',
        'NASA’s Artemis programme is studying nine regions there for a future astronaut landing. This tool helps you compare them.'],
      show: 'Show me the map', go: { view: 'explore', site: 'malapert', zoom: 0 } },
    { title: 'The Sun never climbs high', svg: SVG.tilt,
      text: ['The Earth is tilted by 23.4°, which gives us summer and winter. The Moon is tilted by only 1.5°, so sunlight always arrives almost exactly side-on at its poles.',
        'Standing at the pole you would see the Sun crawl all the way around the horizon about once every 29.5 days, never more than a few degrees up.'],
      show: 'Show me the Sun circling', go: { view: 'explore', site: 'pole', speed: 'day' }, play: true },
    { title: 'Long shadows, and peaks of light', svg: SVG.shadow,
      text: ['With the Sun that low, even a small hill throws a shadow many kilometres long. A lander behind a ridge can sit in the dark for days, while a lander on the peak next to it keeps its solar panels working.',
        'That is why this tool uses the real shape of the land, measured by NASA’s LRO spacecraft, and not a smooth ball.'],
      show: 'Compare a ridge with a low site', go: { view: 'compare', cmp: [{ id: 'ridge', start: s.rs }, { id: 'haworth', start: s.rs }, null, null] } },
    { title: 'Places the Sun never reaches', svg: SVG.psr,
      text: ['Some crater floors near the pole are permanently shadowed: sunlight skims over the rim and has not touched the bottom for a very, very long time. They are among the coldest places known in the Solar System — colder than −200 °C.',
        'Scientists want to visit them because water ice can survive there. Try it: the floor of Shackleton crater gets 0% sunlight in our calculation.'],
      show: 'Show me Shackleton’s dark floor', go: { view: 'timeline', site: 'custom', lat: -89.67, lon: 129.78, rd: 90 } },
    { title: 'Why the Earth plays hide-and-seek', svg: SVG.earth,
      text: ['The Moon always shows the same face to the Earth, so in the Moon’s sky the Earth hardly moves. But the Moon wobbles a little every month (this is called libration), which makes the Earth bob slowly up and down.',
        'Near the pole the Earth sits right on the horizon, so that small bob is enough to hide it: roughly two weeks of radio contact, then two weeks of silence — unless you land on a mountain that faces the Earth.'],
      show: 'Show me the Earth bobbing', go: { view: 'explore', site: 'shackleton-rim', speed: 'day' }, play: true },
    { title: 'Now plan your own mission',
      text: ['You know the two things a lander needs: sunlight for power and a view of the Earth for radio. Pick a mission length and let the tool find the best place and date to land.',
        'Then open “Timeline & scores” to see why, and “Compare” to test other ideas. Tap any underlined word to see what it means.'],
      show: 'Find the best landing window', go: { view: 'finder' } },
  ];
}

let step = 0;
let requestRender = () => {};
let actions = {};

export function initLearnView(onChange, appActions) {
  requestRender = onChange;
  actions = appActions;
  $('#learn-back').addEventListener('click', () => { step = Math.max(0, step - 1); requestRender(); });
  $('#learn-next').addEventListener('click', () => { step = Math.min(tour(getState()).length - 1, step + 1); requestRender(); });
  $('#learn-show').addEventListener('click', () => {
    const t = tour(getState())[step];
    setState({ ...t.go, playing: false, drop: false });
    if (t.play) actions.play();
  });
  const list = $('#glossary-list');
  for (const g of GLOSSARY) list.append(el('dt', { text: g.term }), el('dd', { text: g.text }));
}

export function renderLearnView() {
  const steps = tour(getState());
  const t = steps[step];
  $('#learn-count').textContent = `Step ${step + 1} of ${steps.length}`;
  if ($('#learn-title').textContent !== t.title) { // only rebuild when the step changes
    $('#learn-title').textContent = t.title;
    const body = $('#learn-text');
    body.textContent = '';
    for (const p of t.text) body.append(el('p', { text: p }));
    $('#learn-art').innerHTML = t.svg || ''; // static diagram defined at the top of this file
    $('#learn-art').hidden = !t.svg;
    actions.glossarize(body);
  }
  $('#learn-show').textContent = `${t.show} →`;
  $('#learn-back').disabled = step === 0;
  $('#learn-next').disabled = step === steps.length - 1;
  const dots = $('#learn-dots');
  dots.textContent = '';
  steps.forEach((_, i) => dots.append(el('span', { class: i === step ? 'dot-step on' : 'dot-step' })));
}
