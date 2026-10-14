// Proves that nothing from the original study was lost or changed on the way to the site.
//   node scripts/verify.mjs   (runs after every build)
//
// For every original page in source/, this reads the text the reader saw (the page's heading,
// subtitle and body, in order) and compares it, word for word, with the built page in dist/.
// The only differences allowed are typographic: curly quotes for straight ones, en dashes for
// hyphens between numbers or spaces, and the ellipsis character for three dots; and the image
// placeholder's "[Image: …]" wrapper, which becomes the picture's caption. Anything the site adds
// inside the text (section anchors, picture credits) is marked data-x and ignored.
//
// It also checks the home page carries the original title, subtitle, button and every chapter
// card, and that every in-page link (#…) on every built page lands on an element.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';

const root = new URL('..', import.meta.url).pathname;
const src = (f) => readFile(join(root, 'source', f), 'utf8');
const dist = (f) => readFile(join(root, 'dist', f), 'utf8');

const normalize = (s) =>
  s
    .normalize('NFKC')
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[–—‒―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');
const words = (s) => normalize(s).split(/\s+/).filter(Boolean);

function textOf(el, { skip = () => false } = {}) {
  let out = '';
  const walk = (n) => {
    if (n.nodeType === 3) out += n.data;
    else if (n.nodeType === 1) {
      if (/^(SCRIPT|STYLE|TEMPLATE)$/.test(n.tagName) || skip(n)) return;
      // Block boundaries separate words even without whitespace between them.
      const block = /^(P|LI|H[1-6]|DIV|SECTION|UL|OL|BLOCKQUOTE|FIGURE|FIGCAPTION|BR|HR|TD|TH|TR)$/.test(n.tagName);
      if (block) out += ' ';
      for (const c of n.childNodes) walk(c);
      if (block) out += ' ';
    }
  };
  walk(el);
  return out;
}

function diff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return null;
  const ctx = (arr) => arr.slice(Math.max(0, i - 8), i + 8).join(' ');
  return `first difference at word ${i + 1} of ${a.length} (original) / ${b.length} (site)\n    original: …${ctx(a)}…\n    site:     …${ctx(b)}…`;
}

const failures = [];
const fail = (msg) => failures.push(msg);

/* ── Each chapter and the timeline ─────────────────────────────────────── */
const pages = [{ file: 'timeline.html', id: 'timelinePage', out: 'timeline.html' }];
for (let n = 1; n <= 22; n++) pages.push({ file: `revelation_study_chapter${n}.html`, id: `chapter${n}Page`, out: `revelation-${n}.html` });

let total = 0;
for (const p of pages) {
  const { document: o } = parseHTML(await src(p.file));
  const page = o.getElementById(p.id);
  const oBody = page.querySelector('.content-body');
  // The placeholder wrapper "[Image: …]" becomes a caption; its words must all remain.
  for (const ph of oBody.querySelectorAll('.image-placeholder p')) {
    ph.textContent = ph.textContent.replace(/^\s*\[Image:\s*/, '').replace(/\]\s*$/, '');
  }
  const original = words(textOf(oBody));
  const heading = words(page.querySelector('.content-header h1').textContent).join(' ');
  const subtitle = words(page.querySelector('.content-header p').textContent).join(' ');

  const { document: d } = parseHTML(await dist(p.out));
  const body = d.querySelector('[data-source-body]');
  if (!body) { fail(`${p.out}: no [data-source-body]`); continue; }
  const built = words(textOf(body, { skip: (n) => n.hasAttribute?.('data-x') }));
  const problem = diff(original, built);
  if (problem) fail(`${p.out} ≠ source/${p.file}: ${problem}`);
  total += original.length;

  const header = words([...d.querySelectorAll('[data-source-header]')].map((e) => e.textContent).join(' ')).join(' ');
  if (!header.includes(heading)) fail(`${p.out}: heading "${heading}" missing`);
  if (!header.includes(subtitle) && !words(d.querySelector('h1').textContent).join(' ').includes(subtitle)) fail(`${p.out}: subtitle "${subtitle}" missing`);
}

/* ── The home page: original title, subtitle, button and every chapter card ─ */
{
  const { document: o } = parseHTML(await src('index.html'));
  const { document: list } = parseHTML(await src('revelation_study_chapter1.html'));
  const { document: d } = parseHTML(await dist('index.html'));
  const site = words(textOf(d.body)).join(' ');
  const must = [
    o.querySelector('.hero-content h1').textContent,
    o.querySelector('.hero-content .subtitle').textContent,
    o.querySelector('.hero-content .cta-button').textContent,
    list.querySelector('.chapters-header h1').textContent,
    list.querySelector('.chapters-header p').textContent,
  ];
  for (const card of list.querySelectorAll('#chaptersPage .chapter-card')) {
    must.push(card.querySelector('.chapter-title').textContent, card.querySelector('.chapter-description').textContent);
  }
  for (const m of must) {
    const w = words(m).join(' ');
    if (!site.includes(w)) fail(`index.html: missing "${w}"`);
  }
}

/* ── Every in-page link lands somewhere ─────────────────────────────────── */
for (const out of ['index.html', '404.html', ...pages.map((p) => p.out)]) {
  const { document: d } = parseHTML(await dist(out));
  const ids = new Set([...d.querySelectorAll('[id]')].map((e) => e.id));
  for (const a of d.querySelectorAll('a[href^="#"]')) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id && !ids.has(id)) fail(`${out}: link to #${id} has no target`);
  }
}

if (failures.length) {
  console.error(`\n✗ verify: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error('  • ' + f + '\n');
  process.exit(1);
}
console.log(`✓ verify: all ${pages.length} pages carry every word of the original study (${total.toLocaleString('en-US')} words), the home page carries every chapter card, and every in-page link lands.`);
