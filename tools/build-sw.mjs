// Rewrites the list of files that the service worker (sw.js) saves for offline use.
//   node tools/build-sw.mjs        (run after adding or removing app files)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const dir = (d, keep = () => true) => readdirSync(new URL(d, root)).filter(keep).sort().map((f) => `${d}${f}`);
const files = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', ...dir('icons/'), ...dir('js/'),
  ...dir('vendor/', (f) => f.endsWith('.js')), ...dir('data/')];
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const a = sw.indexOf('const FILES = ');
const b = sw.indexOf('];', a) + 2;
const version = Number(/llsn-offline-v(\d+)/.exec(sw)[1]) + 1;
writeFileSync(new URL('sw.js', root), (sw.slice(0, a) + `const FILES = ${JSON.stringify(files, null, 2)};` + sw.slice(b)).replace(/llsn-offline-v\d+/, `llsn-offline-v${version}`));
console.log(`sw.js: ${files.length} files, cache version ${version}`);
