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
for (const path of ['/timeline', '/revelation-1', '/revelation-2', '/revelation-22', '/404']) {
  const { p, ctx, errors } = await page(path, { width: 390, height: 844 });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0 && errors.length === 0, `phone ${path}: no sideways scroll, no errors ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
