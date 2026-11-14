// 3D Moon view (loaded only when its tab is opened). A rotatable, zoomable globe with the
// real NASA LOLA relief, the landing sites as tappable pins, the Sun as the light source
// and the Earth as a marker in its true direction.
//
// Axes of the 3D scene = Moon-fixed axes: +X = 0° longitude (towards the mean Earth),
// +Y = 90°E, +Z = north pole. The same Sun/Earth vectors as the rest of the app are used.

import * as THREE from '../vendor/three.module.min.js';
import { SITES, CUSTOM_ID } from './sites.js';
import { moonFrame, subEarthPoint, subSolarPoint } from './astro.js';
import { fmtLat, fmtLon } from './ui.js';

const D2R = Math.PI / 180;
const VIEW_ALL = 5.0;    // camera distance (Moon radii) that shows the whole Moon plus the Sun and Earth markers
const VIEW_POLE = 1.42;  // close-up of the south-pole sites
const MIN_DIST = 1.15, MAX_DIST = 7;

const VERT = `
  varying vec3 vPos;
  void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
  precision highp float;
  uniform sampler2D globalTex; uniform sampler2D polarTex;
  uniform float hasGlobal; uniform float hasPolar; uniform vec3 sunDir;
  varying vec3 vPos;
  const float PI = 3.141592653589793;
  void main() {
    vec3 n = normalize(vPos);
    float lat = asin(clamp(n.z, -1.0, 1.0));
    float lon = atan(n.y, n.x);
    vec3 base = vec3(0.45);                                   // neutral grey until the texture has loaded
    if (hasGlobal > 0.5) base = texture2D(globalTex, vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5)).rgb;
    float latDeg = degrees(lat);
    if (hasPolar > 0.5 && latDeg < -80.0) {                   // sharper polar-stereographic map on the south cap
      float r = tan(radians((90.0 + latDeg) / 2.0)) / tan(radians(5.0));
      vec3 cap = texture2D(polarTex, vec2(0.5 + 0.5 * r * sin(lon), 0.5 + 0.5 * r * cos(lon))).rgb;
      base = mix(base, cap, smoothstep(-80.0, -80.8, latDeg));
    }
    float d = max(dot(n, sunDir), 0.0);
    float light = 0.30 + 0.70 * sqrt(d);                      // simplified: smooth-sphere lighting, night side kept visible
    gl_FragColor = vec4(base * light * vec3(1.0, 0.98, 0.94), 1.0);
  }`;

const sitePos = (lat, lon, r = 1) => new THREE.Vector3(
  r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.cos(lat * D2R) * Math.sin(lon * D2R), r * Math.sin(lat * D2R));

/**
 * createMoon3d({ canvas, pins, onSelect }) -> { update(view), reset(), focusPole(), resize() }
 * Throws if WebGL is not available (the caller shows a friendly message).
 */
export function createMoon3d({ canvas, pins, onSelect, onLost }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x04060d);
  canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); onLost(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  const uniforms = {
    globalTex: { value: null }, polarTex: { value: null }, hasGlobal: { value: 0 }, hasPolar: { value: 0 },
    sunDir: { value: new THREE.Vector3(1, 0, 0) },
  };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG })));

  const loader = new THREE.TextureLoader();
  const load = (file, key, flag) => loader.load(new URL(`../data/${file}`, import.meta.url).href, (tex) => {
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    uniforms[key].value = tex; uniforms[flag].value = 1; draw();
  });
  load('relief_global.png', 'globalTex', 'hasGlobal');
  load('relief_80s.png', 'polarTex', 'hasPolar');

  // Earth and Sun markers just outside the Moon's edge (direction is true, size and distance are not)
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), new THREE.MeshBasicMaterial({ color: 0x56b4e9 }));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf0e442 }));
  scene.add(earth, sun);
  const tag = (text, cls) => { const d = document.createElement('div'); d.className = `tag3d ${cls}`; d.textContent = text; pins.append(d); return d; };
  const tags = [{ el: tag('Earth', 'earth'), body: earth }, { el: tag('Sun', 'sun'), body: sun }];
  let frames = 0;

  // ---- camera: free rotation around the Moon's centre (no "stuck at the pole" problem) ----
  const pos = new THREE.Vector3();
  const up = new THREE.Vector3();
  let dist = VIEW_ALL;
  function setView(distance) {            // south pole facing the viewer, 0° longitude up, 90°E to the right (like the map)
    pos.set(0, 0, -1); up.set(1, 0, 0); dist = distance; draw();
  }
  function rotate(dx, dy) {               // dx, dy in radians
    const right = new THREE.Vector3().crossVectors(up, pos).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(up, -dx).multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy));
    pos.applyQuaternion(q).normalize(); up.applyQuaternion(q).normalize(); draw();
  }
  function zoom(factor) { dist = Math.min(MAX_DIST, Math.max(MIN_DIST, dist * factor)); draw(); }

  // ---- pins: real buttons laid over the canvas, so they are tappable and keyboard-accessible ----
  const pinEls = new Map();
  let view = { site: null, custom: null };
  function syncPins() {
    const list = SITES.map((s) => ({ ...s }));
    if (view.custom) list.push({ id: CUSTOM_ID, n: '★', name: 'Custom point', lat: view.custom.lat, lon: view.custom.lon, group: 'custom' });
    for (const [id, p] of pinEls) if (!list.some((s) => s.id === id)) { p.el.remove(); pinEls.delete(id); }
    for (const s of list) {
      let p = pinEls.get(s.id);
      if (!p) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `pin3d ${s.group}`;
        el.innerHTML = '<span class="pin3d-n"></span><span class="pin3d-name"></span>';
        el.addEventListener('click', () => onSelect(s.id));
        pins.append(el);
        p = { el };
        pinEls.set(s.id, p);
      }
      p.v = sitePos(s.lat, s.lon, 1.003);
      p.el.children[0].textContent = s.n;
      p.el.children[1].textContent = s.name;
      p.el.setAttribute('aria-label', `${s.name}, ${fmtLat(s.lat)}, ${fmtLon(s.lon)}`);
      p.el.setAttribute('aria-pressed', String(s.id === view.site));
    }
  }

  let queued = false;
  function draw() { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; drawNow(); }); } }
  function drawNow() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.copy(pos).multiplyScalar(dist);
    camera.up.copy(up);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frames); // lets the automated test see that drawing happens
    for (const t of tags) { // name tags for the Earth and Sun markers
      const s = t.body.position.clone().project(camera);
      const on = s.z < 1 && Math.abs(s.x) < 1 && Math.abs(s.y) < 1;
      t.el.hidden = !on;
      if (on) t.el.style.transform = `translate(${((s.x + 1) / 2) * w}px, ${((1 - s.y) / 2) * h}px)`;
    }
    // place the pins; hide those on the far side of the Moon
    pins.classList.toggle('near', dist < 1.9);
    const camDir = camera.position.clone().normalize();
    for (const p of pinEls.values()) {
      const facing = p.v.clone().normalize().dot(camDir) > 1 / dist + 0.02; // above the visible edge
      const s = p.v.clone().project(camera);
      const on = facing && Math.abs(s.x) < 1.05 && Math.abs(s.y) < 1.05;
      p.el.hidden = !on;
      if (on) p.el.style.transform = `translate(${((s.x + 1) / 2) * w}px, ${((1 - s.y) / 2) * h}px)`;
    }
  }

  // ---- touch, mouse and keyboard ----
  const touches = new Map();
  let lastTap = 0, pinch = 0, moved = 0;
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
    moved = 0;
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  canvas.addEventListener('pointermove', (ev) => {
    const prev = touches.get(ev.pointerId);
    if (!prev) return;
    touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (touches.size === 1) {
      // the surface roughly follows the finger: slower when zoomed in, faster for the whole Moon
      const k = (0.9 * (dist - 1) + 0.05) / Math.max(200, canvas.clientHeight);
      moved += Math.abs(ev.clientX - prev[0]) + Math.abs(ev.clientY - prev[1]);
      rotate((ev.clientX - prev[0]) * k, (ev.clientY - prev[1]) * k);
    } else if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && d > 0) zoom(pinch / d);
      pinch = d;
      moved += 10;
    }
  });
  const end = (ev) => {
    if (!touches.has(ev.pointerId)) return;
    touches.delete(ev.pointerId);
    if (ev.type === 'pointerup' && touches.size === 0 && moved < 8) { // a tap; two quick taps = reset
      const now = Date.now();
      if (now - lastTap < 350) { setView(VIEW_ALL); lastTap = 0; } else lastTap = now;
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); zoom(ev.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
  canvas.addEventListener('keydown', (ev) => {
    const step = 6 * D2R * Math.min(1, dist - 0.9);
    const keys = { ArrowLeft: () => rotate(-step, 0), ArrowRight: () => rotate(step, 0), ArrowUp: () => rotate(0, -step), ArrowDown: () => rotate(0, step),
      '+': () => zoom(0.9), '=': () => zoom(0.9), '-': () => zoom(1.1), Home: () => setView(VIEW_ALL), 0: () => setView(VIEW_ALL), p: () => setView(VIEW_POLE) };
    if (keys[ev.key]) { ev.preventDefault(); keys[ev.key](); }
  });

  setView(VIEW_ALL);

  return {
    /** view = { t, site, custom: {lat, lon} | null } -> returns a text description of the scene */
    update(next) {
      view = next;
      const frame = moonFrame(next.t);
      const local = (v) => new THREE.Vector3(v[0] * frame.x[0] + v[1] * frame.x[1] + v[2] * frame.x[2],
        v[0] * frame.y[0] + v[1] * frame.y[1] + v[2] * frame.y[2], v[0] * frame.z[0] + v[1] * frame.z[1] + v[2] * frame.z[2]).normalize();
      const sunDir = local(frame.toSun);
      uniforms.sunDir.value.copy(sunDir);
      sun.position.copy(sunDir).multiplyScalar(1.4);
      earth.position.copy(local(frame.toEarth)).multiplyScalar(1.4);
      syncPins();
      draw();
      const ss = subSolarPoint(frame), se = subEarthPoint(frame);
      return `The Sun is overhead at ${fmtLat(ss.lat)}, ${fmtLon(ss.lon)} and lights that half of the Moon. `
        + `The Earth is overhead at ${fmtLat(se.lat)}, ${fmtLon(se.lon)}.`;
    },
    reset: () => setView(VIEW_ALL),
    focusPole: () => setView(VIEW_POLE),
    resize: draw,
  };
}
