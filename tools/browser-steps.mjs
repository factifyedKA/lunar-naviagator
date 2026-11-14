// The click-through script used by browser-check.mjs. Extended at every milestone.
const landscape = { width: 1180, height: 820 };  // iPad Air landscape
const portrait = { width: 820, height: 1180 };   // iPad Air portrait

export default async function run({ session, base }) {
  await session('landscape', landscape, async (page, shot, check) => {
    await page.goto(base);
    await page.waitForSelector('.site-btn');
    check(await page.locator('.site-btn').count() === 13, '13 sites listed');
    await page.waitForTimeout(400);
    await shot('1-start');
    if (await page.locator('#welcome').count()) {
      check(await page.isVisible('#welcome'), 'welcome card greets a first-time visitor');
      check(await page.locator('.tab:visible').count() === 7, 'all seven tabs are visible in Simple mode, including Compare and Validation');
      check(await page.locator('.site-btn:visible').count() === 13, 'site list shows all 13 sites, the same as the map and the ranking');
      await page.click('#welcome-go');
      check(!(await page.isVisible('#welcome')), 'welcome card closes');
      check(/right now/.test(await page.textContent('#now-verdict')), 'plain verdict line is shown');
    }
    if (await page.locator('#mode-expert').count()) {
      check(!(await page.isVisible('#custom-form')), 'Simple mode hides expert controls');
      await page.click('#mode-expert');
      check(await page.isVisible('#custom-form'), 'Expert mode shows them');
    }
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
    if (await page.locator('#cmp-table').count()) await planSteps(page, shot, check);
    if (await page.locator('#learn-show').count()) await learnSteps(page, shot, check);
    if (await page.locator('#scenario-cards').count()) await impactSteps(page, shot, check);
    if (await page.locator('#val-list').count()) {
      await page.click('.tab[data-view="validation"]');
      await page.waitForFunction(() => /checks passed/.test(document.querySelector('#val-summary').textContent)
        && document.querySelectorAll('#val-list .check').length >= 22, null, { timeout: 60000 }).catch(() => {});
      const summary = await page.textContent('#val-summary');
      check(/^All \d+ checks passed\.$/.test(summary), `validation page: ${summary}`);
      check(await page.locator('#val-terrain tbody tr').count() === 12, 'NASA illumination table has 12 rows');
      const hl = await page.textContent('#val-headline');
      check(/never more than 0\.0\d+° off/.test(hl) && /percentage points away/.test(hl) && /permanently shadowed/.test(hl), `validation headline is written (${hl.slice(0, 80)}…)`);
      check(await page.locator('#val-horizons tbody tr').count() === 110, 'Horizons table has 110 rows');
      await shot('14-validation');
      await page.click('.tab[data-view="explore"]');
      check(/until|back on|next 60 days/.test(await page.textContent('#sun-next')), 'look-ahead line is shown');
    }
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
  check(/above the local horizon \(terrain\) · [+−]\d+\.\d\d° elevation above a flat surface/.test(await page.textContent('#sun-angles')), `two angles are labelled (${await page.textContent('#sun-angles')})`);
  await page.locator('.info-btn').first().click();
  check((await page.textContent('#term-pop')).includes('real skyline'), 'angle tooltip explains the difference');
  await page.keyboard.press('Escape');
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

// Milestone 4: compare and best-window finder
async function planSteps(page, shot, check) {
  await page.click('.site-btn[data-site="malapert"]');
  await page.click('.tab[data-view="compare"]');
  await page.waitForFunction(() => document.querySelectorAll('#cmp-table tbody tr').length === 6
    && document.querySelectorAll('#cmp-table thead th').length === 4, null, { timeout: 15000 });
  check(await page.locator('#cmp-charts canvas').count() === 3, 'three timelines by default');
  check(await page.locator('#cmp-table td.best').count() >= 6, 'best values are starred');
  // same site on another date in slot D
  await page.selectOption('#cmp-site-3', 'malapert');
  await page.fill('#cmp-date-3', '2027-06-01');
  await page.locator('#cmp-date-3').dispatchEvent('change');
  await page.waitForFunction(() => document.querySelectorAll('#cmp-table thead th').length === 5, null, { timeout: 15000 });
  await page.waitForTimeout(700);
  check(page.url().includes('cmp='), 'compare choice is saved in the link');
  await shot('10-compare');
  await page.selectOption('#cmp-site-1', '');
  await page.waitForTimeout(300);
  check(await page.locator('#cmp-charts canvas').count() === 3, 'emptying a slot removes its chart');

  await page.click('.tab[data-view="finder"]');
  await page.waitForFunction(() => document.querySelectorAll('#fw-table tbody tr').length === 10, null, { timeout: 20000 });
  check(/Best 14-day window/.test(await page.textContent('#fw-answer')), 'finder gives a plain answer');
  await page.click('[data-ml="30"]');
  await page.waitForFunction(() => document.querySelector('#fw-answer').textContent.includes('30-day'), null, { timeout: 20000 });
  await shot('11-finder');
  await page.click('#fw-site');
  await page.waitForFunction(() => document.querySelectorAll('#fw-table tbody tr').length < 10, null, { timeout: 20000 });
  check(await page.locator('#fw-table tbody tr').count() >= 3, 'single-site search lists several windows');
  await page.locator('#fw-table tbody tr button').first().click();
  await page.waitForTimeout(400);
  check(await page.isVisible('#view-timeline'), '"Open timeline" jumps to the timeline');
}

// Milestone 5: learn mode, glossary, export, share
async function learnSteps(page, shot, check) {
  await page.click('.tab[data-view="learn"]');
  check((await page.textContent('#learn-count')).includes('Step 1 of 6'), 'tour starts at step 1');
  check(await page.locator('#glossary-list dt').count() >= 15, 'glossary is listed');
  await page.click('#learn-next'); await page.click('#learn-next'); await page.click('#learn-next');
  check((await page.textContent('#learn-title')).includes('never reaches'), 'tour step 4 is about shadowed craters');
  check(await page.locator('#learn-art svg').count() === 1, 'step has a diagram');
  const term = page.locator('#learn-text .term').first();
  await term.click();
  check(await page.isVisible('#term-pop'), 'tapping a glossary word opens its explanation');
  await shot('12-learn');
  await page.keyboard.press('Escape');
  check(!(await page.isVisible('#term-pop')), 'Escape closes the explanation');
  await page.click('#learn-show');
  await page.waitForFunction(() => /^0\.0%/.test(document.querySelector('#tl-tiles .tile-value')?.textContent || ''), null, { timeout: 25000 })
    .catch(() => check(false, 'Shackleton floor shows 0% sunlight'));
  await shot('13-psr-timeline');
  // exports
  const grab = async (selector, ext) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click(selector)]);
    check(d.suggestedFilename().endsWith(ext), `${selector} downloads a ${ext} file (${d.suggestedFilename()})`);
    return d;
  };
  const csv = await grab('#tl-csv', '.csv');
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(await csv.path(), 'utf8');
  check(text.startsWith('# Lunar Landing Site Navigator') && text.includes('time_utc,') && text.split('\n').length > 2000, 'timeline CSV has metadata, a header and hourly rows');
  await grab('#tl-png', '.png');
  await grab('#rank-csv', '.csv');
  await page.click('.tab[data-view="compare"]');
  await page.waitForFunction(() => document.querySelectorAll('#cmp-table tbody tr').length === 6, null, { timeout: 15000 });
  await grab('#cmp-csv', '.csv');
  await grab('#cmp-png', '.png');
  await page.click('.tab[data-view="finder"]');
  await page.waitForFunction(() => document.querySelectorAll('#fw-table tbody tr').length > 0, null, { timeout: 25000 });
  await grab('#fw-csv', '.csv');
  await grab('#fw-png', '.png');
  await page.click('.tab[data-view="explore"]');
  await grab('#map-png', '.png');
  await grab('#sky-png', '.png');
  await page.click('#share-btn');
  check(await page.isVisible('#toast'), 'share button gives feedback');
  check(page.url().includes('m=x'), 'expert mode is kept in the link');
}

// Step 2 of the enhancement round: scenario cards, mission brief, worksheet
async function impactSteps(page, shot, check) {
  await page.click('.tab[data-view="explore"]');
  await page.click('.site-btn[data-site="malapert"]');
  check(await page.locator('.scenario').count() === 3, 'three scenario cards');
  await page.click('.scenario[data-scenario="week"]');
  await page.waitForFunction(() => /Best 7-day landing window in 2027: /.test(document.querySelector('#scenario-text').textContent), null, { timeout: 30000 })
    .catch(() => check(false, 'scenario card answers'));
  check(/landing on \d+ \w+ 2027/.test(await page.textContent('#scenario-text')), 'scenario answer is one plain sentence with a date');
  await page.locator('#scenario-cards').scrollIntoViewIfNeeded();
  await shot('15-scenario');
  await page.click('#scenario-open');
  check(await page.isVisible('#view-finder') && (await page.inputValue('#fw-length')) === '7', 'scenario link opens the full finder view');
  // mission brief from the timeline and from compare
  await page.click('.tab[data-view="timeline"]');
  await page.click('#tl-brief');
  await page.waitForFunction(() => document.querySelector('#brief-canvas').getAttribute('aria-label').includes('score'), null, { timeout: 20000 })
    .catch(() => check(false, 'mission brief is drawn'));
  const size = await page.evaluate(() => { const c = document.querySelector('#brief-canvas'); return [c.width, c.height]; });
  check(size[0] === 1588 && size[1] === 2246, 'brief is one A4 page');
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#brief-png')]);
  check(d.suggestedFilename() === 'mission-brief.png', 'brief saves as PNG');
  await d.saveAs(new URL('../docs/mission-brief-example.png', import.meta.url).pathname);
  await page.click('#brief-back');
  check(await page.isVisible('#view-timeline'), 'brief back button returns');
  await page.click('.tab[data-view="compare"]');
  await page.click('#cmp-brief');
  await page.waitForFunction(() => (document.querySelector('#brief-canvas').getAttribute('aria-label').match(/score/g) || []).length >= 2, null, { timeout: 20000 })
    .catch(() => check(false, 'compare brief lists several sites'));
  await shot('16-brief-compare');
  // worksheet
  await page.click('.tab[data-view="learn"]');
  await page.click('#open-worksheet');
  check(await page.locator('.sheet-questions li').count() === 4, 'worksheet has four questions');
  check(/most Earth contact — .*most sunlight — /.test(await page.textContent('#ws-key-2')), "teacher's key is filled from the year simulation");
  await shot('17-worksheet');
  await page.click('#ws-back');
}
