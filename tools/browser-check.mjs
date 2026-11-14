// Opens the app in a headless browser, clicks through it, saves screenshots and
// reports any console errors.  Usage: node tools/browser-check.mjs [outDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // uses the machine's installed Playwright
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = resolve(process.argv[2] || 'screenshots');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(root, path === '/' ? 'index.html' : path);
    if (!file.startsWith(root)) throw new Error('outside');
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const problems = [];
const browser = await chromium.launch();
async function session(name, viewport, steps) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${name}] console ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${name}] page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[${name}] request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[${name}] HTTP ${r.status()}: ${r.url()}`); });
  const click = page.click.bind(page);
  page.click = async (...a) => { await click(...a); await page.waitForTimeout(80); }; // let the app redraw
  const shot = (label) => page.screenshot({ path: join(out, `${name}-${label}.png`) });
  const check = (cond, msg) => { if (!cond) problems.push(`[${name}] CHECK FAILED: ${msg}`); };
  await steps(page, shot, check);
  await page.close();
}
export { session, base, problems, browser, server };

const { default: run } = await import('./browser-steps.mjs');
await run({ session, base });
await browser.close();
server.close();
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; } else console.log('Browser check: no errors.');
