// Interaction QA against a running build.  node scripts/qa.mjs <baseUrl> [chromium|webkit]
import { chromium, webkit } from 'playwright-core';
const [base = 'http://localhost:4331', engine = 'chromium'] = process.argv.slice(2);
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failed++; };

async function page(path, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Refused to apply a stylesheet/.test(m.text())) errors.push(m.text()); });
  await p.goto(base + path, { waitUntil: 'networkidle' });
  return { p, ctx, errors };
}

console.log(`QA (${engine}) ${base}`);
{
  const { p, ctx, errors } = await page('/');
  ok((await p.title()).startsWith('Revelation Study'), 'home: title');
  await p.click('.menu-btn');
  await p.waitForTimeout(400);
  ok(await p.locator('#chapters-menu').isVisible(), 'home: chapters menu opens');
  ok((await p.locator('#chapters-menu a').count()) === 23, 'home: menu lists 23 entries');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  ok(!(await p.locator('#chapters-menu').isVisible()), 'home: Escape closes the menu');
  ok((await p.locator('.cards .card').count()) === 22, 'home: 22 chapter cards');
  const ld = await p.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)));
  ok(ld.length === 1 && ld[0]['@graph'].some((n) => n['@type'] === 'Book'), 'home: structured data parses (Book)');
  ok(errors.length === 0, `home: no script errors ${errors.join(' | ')}`);
  await ctx.close();
}
{
  const { p, ctx, errors } = await page('/revelation-4');
  ok((await p.locator('link[rel=canonical]').getAttribute('href')) === 'https://revstudy.sathwiksangeetham.com/revelation-4', 'ch4: canonical');
  const fn = p.locator('sup.fn a').first();
  await fn.scrollIntoViewIfNeeded();
  const box = await fn.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(500);
  ok(await p.locator('.note-card.open').isVisible(), 'ch4: footnote card opens on hover');
  const txt = await p.locator('.note-card').innerText();
  ok(/Darby|Kelly|Walvoord|Bible Truth/i.test(txt), `ch4: footnote card names its source (“${txt.split('\n')[1]?.slice(0, 50)}”)`);
  await p.locator('#the-twenty-four-elders, [id^="revelation-4-4"]').first().scrollIntoViewIfNeeded();
  await p.evaluate(() => scrollBy(0, 200));
  await p.waitForTimeout(600);
  const cur = await p.locator('.toc a[aria-current]').innerText();
  ok(/Elders/.test(cur), `ch4: contents follows the reader (“${cur.replace(/\n/g, ' ')}”)`);
  ok(errors.length === 0, `ch4: no script errors ${errors.join(' | ')}`);
  await ctx.close();
}
{
  const { p, ctx, errors } = await page('/revelation-4', { width: 390, height: 844 });
  const fn = p.locator('sup.fn a').first();
  await fn.scrollIntoViewIfNeeded();
  await fn.tap?.().catch(() => {});
  await fn.click();
  await p.waitForTimeout(400);
  ok(await p.locator('.note-card.open').isVisible() || p.url().includes('#note-'), 'phone ch4: tapping a note number shows it');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, `phone ch4: no sideways scroll (${overflow}px)`);
  await p.click('.toc-mobile summary');
  ok(await p.locator('.toc-mobile ol').isVisible(), 'phone ch4: contents opens');
  ok(errors.length === 0, `phone ch4: no script errors ${errors.join(' | ')}`);
  await ctx.close();
}
{
  // The reader: settings kept, focus, picking up where you left off, keys.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '/revelation-5', { waitUntil: 'networkidle' });
  await p.click('.rail .tool >> nth=0');
  await p.waitForTimeout(400);
  ok(await p.locator('#reader-settings').isVisible(), 'reader: settings open from the rail');
  await p.click('label:has(input[name=size][value="2"])');
  await p.click('label:has(input[name=paper][value=white])');
  ok((await p.evaluate(() => document.documentElement.dataset.size)) === '2', 'reader: a larger size applies at once');
  await p.reload({ waitUntil: 'networkidle' });
  const kept = await p.evaluate(() => [document.documentElement.dataset.size, document.documentElement.dataset.paper, document.querySelector('input[name=size][value="2"]').checked]);
  ok(kept[0] === '2' && kept[1] === 'white' && kept[2] === true, `reader: settings kept after reload (${kept})`);
  await p.click('.rail .tool >> nth=0');
  await p.click('[data-reader-reset]');
  ok(!(await p.evaluate(() => document.documentElement.hasAttribute('data-size') || document.documentElement.hasAttribute('data-paper'))), 'reader: restore the defaults');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.click('.rail [data-focus-toggle]');
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => document.documentElement.dataset.focus)) === 'on' && !(await p.locator('.reader > .toc').isVisible()) && (await p.locator('.readbar').isVisible()), 'reader: focus hides the side columns, the reading bar stays');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => document.documentElement.hasAttribute('data-focus'))), 'reader: Escape leaves focus');
  // Read halfway, come back.
  await p.evaluate(() => { const b = document.querySelector('.study .body'); scrollTo(0, b.getBoundingClientRect().top + scrollY + b.offsetHeight * 0.5); });
  await p.waitForTimeout(900);
  const sec = await p.locator('.rail [data-sec]').innerText();
  const left = await p.locator('.rail [data-left]').innerText();
  ok(/min left/.test(left) && sec.length > 3, `reader: rail shows the section and time left (“${sec}”, ${left})`);
  await p.goto(base + '/revelation-5', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  ok(await p.locator('[data-resume]').isVisible(), 'reader: offers to pick up where you left off');
  await p.click('[data-resume-go]');
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => scrollY)) > 2000, 'reader: continue returns to your place');
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  ok(await p.locator('[data-continue]').isVisible() && (await p.locator('[data-continue]').getAttribute('href')) === '/revelation-5', 'home: continue reading card');
  await p.goto(base + '/revelation-5', { waitUntil: 'networkidle' });
  await p.keyboard.press('ArrowRight');
  await p.waitForURL(/revelation-6/, { timeout: 5000 }).catch(() => {});
  ok(/revelation-6$/.test(p.url()), 'reader: → turns to the next chapter');
  await p.goto(base + '/revelation-14', { waitUntil: 'networkidle' });
  const fn14 = p.locator('sup.fn a').first();
  await fn14.scrollIntoViewIfNeeded();
  const b14 = await fn14.boundingBox();
  await p.mouse.move(b14.x + b14.width / 2, b14.y + b14.height / 2);
  await p.waitForTimeout(500);
  ok(/lists its sources together/.test(await p.locator('.note-card').innerText()) && (await p.locator('.note-card li').count()) > 2, 'ch14: a note card lists the chapter’s sources');
  ok((await p.locator('.study .v-text').count()) >= 7, 'ch14: verses set apart');
  ok(errors.length === 0, `reader: no script errors ${errors.join(' | ')}`);
  await ctx.close();
}
{
  const { p, ctx, errors } = await page('/revelation-2', { width: 390, height: 844 });
  ok(await p.locator('.readbar').isVisible(), 'phone: reading bar shows');
  await p.evaluate(() => scrollTo(0, 3000));
  await p.waitForTimeout(150);
  await p.evaluate(() => scrollTo(0, 3600));
  await p.waitForTimeout(700);
  ok(await p.locator('.readbar.away').count() === 1, 'phone: reading bar steps aside while reading down');
  await p.evaluate(() => scrollTo(0, 3000));
  await p.waitForTimeout(700);
  ok(await p.locator('.readbar.away').count() === 0, 'phone: and returns on scrolling up');
  await p.click('.readbar .rb-btn >> nth=0');
  await p.waitForTimeout(500);
  ok(await p.locator('#toc-sheet').isVisible(), 'phone: contents sheet opens');
  await p.click('#toc-sheet a >> nth=2');
  await p.waitForTimeout(900);
  ok(!(await p.locator('#toc-sheet').isVisible()) && p.url().includes('#'), 'phone: choosing a section closes the sheet');
  ok((await p.locator('.study .v-text').count()) >= 27, 'phone ch2: every verse set apart');
  ok(errors.length === 0, `phone reader: no script errors ${errors.join(' | ')}`);
  await ctx.close();
}
for (const path of ['/timeline', '/revelation-1', '/revelation-2', '/revelation-22', '/404']) {
  const { p, ctx, errors } = await page(path, { width: 390, height: 844 });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0 && errors.length === 0, `phone ${path}: no sideways scroll, no errors ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
