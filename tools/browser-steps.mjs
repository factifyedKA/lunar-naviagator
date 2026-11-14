// The click-through script used by browser-check.mjs. Extended at every milestone.
const landscape = { width: 1180, height: 820 };  // iPad Air landscape
const portrait = { width: 820, height: 1180 };   // iPad Air portrait

export default async function run({ session, base }) {
  await session('landscape', landscape, async (page, shot, check) => {
    await page.goto(base);
    await page.waitForSelector('.site-btn');
    check(await page.locator('.site-btn').count() === 13, '13 sites listed');
    await shot('1-start');
    // pick a site from the list
    await page.click('.site-btn[data-site="nobile-1"]');
    check((await page.textContent('#site-name')).includes('Nobile Rim 1'), 'site card follows list');
    // tap a marker on the map: the South Pole is exactly in the centre
    const box = await page.locator('#map').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(100);
    const name = await page.textContent('#site-name');
    check(/South Pole|Shackleton|Connecting/.test(name), `tapping map centre selects a polar site (got ${name})`);
    await page.waitForFunction(() => document.querySelector('#site-terrain').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    // zoom in twice, out once
    await page.click('#zoom-in'); await page.click('#zoom-in');
    check(await page.isDisabled('#zoom-in'), 'zoom-in disabled at max');
    await shot('2-zoomed');
    await page.click('#zoom-out');
    // drop a custom pin
    await page.click('#drop-btn');
    await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.4);
    await page.waitForTimeout(100);
    check((await page.textContent('#site-name')).includes('Custom point'), 'custom pin placed');
    check(await page.locator('.site-btn[data-site="custom"]').count() === 1, 'custom point appears in list');
    // typed coordinates
    await page.fill('#custom-lat', '-86.5'); await page.fill('#custom-lon', '120');
    await page.click('#custom-form button[type=submit]');
    await page.waitForTimeout(500);
    check(page.url().includes('c=-86.500,120.000'), `URL holds the custom point (${page.url()})`);
    await shot('3-custom');
    // share link: reload the same URL and expect the same view
    const url = page.url();
    await page.goto('about:blank'); await page.goto(url);
    await page.waitForSelector('.site-btn');
    check((await page.textContent('#site-coords')).includes('86.50°S'), 'state restored from URL');
    if (await page.locator('#play').count()) await skySteps(page, shot, check);
    if (await page.locator('#tl-chart').count()) await timelineSteps(page, shot, check);
    // about tab
    await page.click('.tab[data-view="about"]');
    check(await page.isVisible('#view-about'), 'about view opens');
    await shot('9-about');
  });

  await session('portrait', portrait, async (page, shot, check) => {
    await page.goto(base + '#s=ridge&z=1');
    await page.waitForSelector('.site-btn');
    check((await page.textContent('#site-name')).includes('Connecting Ridge'), 'deep link selects site');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!overflow, 'no horizontal scrolling in portrait');
    await shot('1-start');
    if (await page.locator('#play').count()) {
      await page.locator('#sky').scrollIntoViewIfNeeded();
      await shot('2-sky');
    }
  });

  await session('phone', { width: 390, height: 844 }, async (page, shot, check) => {
    await page.goto(base);
    await page.waitForSelector('.site-btn');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!overflow, 'no horizontal scrolling on a phone');
    await shot('1-start');
  });
}

// Milestone 2: horizon view and time controls
async function skySteps(page, shot, check) {
  await page.click('.site-btn[data-site="malapert"]');
  const before = await page.textContent('#sun-line');
  check(/Sun is \d+\.\d° (above|below) the horizon/.test(before), `sun sentence reads well (${before})`);
  check(/Earth is \d+\.\d° (above|below) the horizon/.test(await page.textContent('#earth-line')), 'earth sentence reads well');
  await page.click('#step-fwd');
  check((await page.textContent('#sun-line')) !== before, 'stepping a day changes the Sun');
  await page.locator('#time-slider').focus();
  await page.keyboard.press('ArrowRight');
  await page.click('#speed-day');
  await page.click('#play');
  await page.waitForTimeout(1200);
  check((await page.getAttribute('#play', 'aria-pressed')) === 'true', 'play button shows playing');
  await page.click('#play');
  const t1 = await page.inputValue('#time-input');
  await page.waitForTimeout(300);
  check(t1 === await page.inputValue('#time-input'), 'pause stops time');
  await page.fill('#time-input', '2026-03-03T11:34');
  await page.locator('#time-input').dispatchEvent('change');
  await page.waitForTimeout(150);
  check((await page.textContent('#sun-chip')).includes('Eclipse'), 'eclipse of 3 March 2026 is reported');
  await page.locator('#sky').scrollIntoViewIfNeeded();
  await shot('4-sky-eclipse-terrain');
  await page.click('#hm-flat');
  await page.locator('#hz').fill('2');
  await page.waitForTimeout(150);
  check((await page.textContent('#hm-note')).includes('flat'), 'flat mode is labelled');
  await page.locator('#hz').fill('0');
  await page.click('#hm-terrain');
  check((await page.textContent('#site-terrain')).includes('Terrain viewpoint'), 'terrain viewpoint is shown');
  await page.click('#now-btn');
  await page.waitForTimeout(200);
  await shot('5-sky-now');
}

// Milestone 3: timeline, scores, ranking
async function timelineSteps(page, shot, check) {
  await page.click('.site-btn[data-site="ridge"]');
  await page.click('.tab[data-view="timeline"]');
  await page.waitForFunction(() => document.querySelector('#tl-score').textContent !== '–', null, { timeout: 15000 });
  check(await page.locator('#tl-tiles .tile').count() === 5, 'five score tiles');
  check(await page.locator('#rank-table tbody tr').count() === 13, 'ranking lists 13 sites');
  const score1 = await page.textContent('#tl-score');
  await page.locator('#w-earth').fill('0');
  await page.locator('#w-outage').fill('0');
  await page.waitForTimeout(150);
  const score2 = await page.textContent('#tl-score');
  check(score1 !== score2, `weights change the score (${score1} -> ${score2})`);
  await shot('6-timeline');
  await page.click('#tl-reset');
  await page.selectOption('#tl-days', '365');
  await page.waitForFunction(() => document.querySelector('#tl-caption').textContent.includes('365 days'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.locator('#tl-chart').scrollIntoViewIfNeeded();
  const box = await page.locator('#tl-chart').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + 60);
  await page.waitForTimeout(150);
  check(/Sun [+−]/.test(await page.textContent('#tl-cursor')), 'tapping the chart shows values');
  await page.locator('#emin').fill('3');
  await page.waitForTimeout(800);
  await page.locator('#tl-chart').scrollIntoViewIfNeeded();
  await shot('7-timeline-year');
  await page.locator('#emin').fill('0');
  await page.waitForTimeout(800);
  await page.click('#tl-goto');
  check(await page.isVisible('#view-explore'), '"show this moment" returns to Explore');
  // custom point gets a real-terrain horizon from the worker
  await page.click('.site-btn[data-site="custom"]');
  await page.waitForFunction(() => document.querySelector('#hm-note').textContent.includes('960 m'), null, { timeout: 20000 })
    .catch(() => check(false, 'custom point terrain horizon arrives'));
  await page.locator('#sky').scrollIntoViewIfNeeded();
  await shot('8-custom-terrain');
}
