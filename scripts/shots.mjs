// Screenshots for design review.  node scripts/shots.mjs <baseUrl> <outDir> [name:path:width:height:scrollY ...]
import { chromium } from 'playwright-core';
const [base, out, ...specs] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
for (const spec of specs) {
  const [name, path, w, h, y = '0', full = ''] = spec.split(':');
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(base + path, { waitUntil: 'networkidle' });
  if (isNaN(+y)) await p.locator(y).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  else await p.evaluate((yy) => window.scrollTo(0, yy), +y);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: full === 'full' });
  if (errors.length) console.log(name, 'ERRORS:', errors.slice(0, 4).join(' | '));
  await ctx.close();
}
await b.close();
console.log('done');
