// Typeset share images (1200×630) for every page: vellum, the arch of light, the chapter number.
//   node scripts/og.mjs
// Titles and descriptions come from the original chapter list (source/), as on the site.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { PARTS } from '../src/lib/parts.ts';

const here = (p) => new URL(p, import.meta.url);
const font = async (file, weight, style, name) => ({ name, data: await readFile(here(`og-fonts/${file}.woff`)), weight, style });
const fonts = await Promise.all([
  font('cormorant-garamond-latin-300-normal', 300, 'normal', 'Cormorant'),
  font('cormorant-garamond-latin-500-normal', 500, 'normal', 'Cormorant'),
  font('cormorant-garamond-latin-400-italic', 400, 'italic', 'Cormorant'),
  font('eb-garamond-latin-400-normal', 400, 'normal', 'Garamond'),
  font('eb-garamond-latin-500-normal', 500, 'normal', 'Garamond'),
]);

// The same typesetting as the site (curly quotes, dashes between numbers).
const smart = (t) =>
  t
    .replace(/(^|[\s(“‘])"/g, '$1“').replace(/"/g, '”')
    .replace(/(\p{L})'/gu, '$1’').replace(/(^|[\s(“])'/g, '$1‘').replace(/'/g, '’')
    .replace(/(\d)-(\d)/g, '$1–$2').replace(/ - /g, ' – ');

const { document } = parseHTML(await readFile(here('../source/revelation_study_chapter1.html'), 'utf8'));
const cards = [...document.querySelectorAll('#chaptersPage .chapter-card')].map((c) => ({
  n: Number(c.querySelector('.chapter-number').textContent.trim()),
  title: smart(c.querySelector('.chapter-title').textContent.replace(/\s+/g, ' ').trim()),
  description: smart(c.querySelector('.chapter-description').textContent.replace(/\s+/g, ' ').trim()),
}));

const groupOf = (n) => {
  for (const part of PARTS) for (const g of part.groups) if (g.chapters.includes(n)) return { part, g };
  return { part: PARTS[2], g: { title: 'The prophetic timeline', accent: '#8a6a2c' } };
};

const STAR = 'M32 1 L33.61 28.12 L42.61 21.39 L35.88 30.39 L63 32 L35.88 33.61 L42.61 42.61 L33.61 35.88 L32 63 L30.39 35.88 L21.39 42.61 L28.12 33.61 L1 32 L28.12 30.39 L21.39 21.39 L30.39 28.12Z';
const star = (size, color) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><path fill="${color}" d="${STAR}"/></svg>`).toString('base64');

// The arch of light, drawn once.
const arch = 'data:image/png;base64,' + new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="380" height="560" viewBox="0 0 380 560">
  <defs>
    <radialGradient id="l" cx="50%" cy="36%" r="60%"><stop offset="0" stop-color="#fffdf6"/><stop offset=".45" stop-color="#fbf1d8"/><stop offset="1" stop-color="#ead7a8"/></radialGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6e4e8" stop-opacity="0"/><stop offset="1" stop-color="#c4d8e0" stop-opacity=".7"/></linearGradient>
  </defs>
  <path d="M0 560 V190 A190 190 0 0 1 380 190 V560 Z" fill="url(#l)"/>
  <circle cx="190" cy="205" r="118" fill="none" stroke="#2f6a55" stroke-opacity=".3" stroke-width="1.5"/>
  <rect x="0" y="430" width="380" height="130" fill="url(#s)"/>
  ${Array.from({ length: 18 }, (_, i) => `<line x1="0" x2="380" y1="${440 + i * 7}" y2="${440 + i * 7}" stroke="#fff" stroke-opacity=".6"/>`).join('')}
  <path d="M0.5 560 V190 A189.5 189.5 0 0 1 379.5 190 V560" fill="none" stroke="#a8864b" stroke-width="1.5"/>
  ${Array.from({ length: 7 }, (_, k) => { const t = k / 6, x = 84 + t * 212, y = 112 - Math.sin(t * Math.PI) * 48, s = k === 3 ? 0.36 : 0.26; return `<path transform="translate(${x} ${y}) scale(${s}) translate(-32 -32)" fill="#a8864b" d="${STAR}"/>`; }).join('')}
</svg>`, { fitTo: { mode: 'width', value: 380 } }).render().asPng().toString('base64');

const h = (type, style, children) => ({ type, props: { style, children } });

const jobs = [
  { out: 'default', eyebrow: 'The Book of Revelation', big: 'Revelation', title: 'An In-Depth Study & Commentary', desc: 'Chapters 1 to 22, verse by verse, with a dispensational timeline from the Rapture to the Great White Throne.', accent: '#8a6a2c', mode: 'home' },
  ...cards.map((c) => {
    const { part, g } = groupOf(c.n);
    return c.n === 0
      ? { out: 'timeline', eyebrow: 'Chapter 00 · The prophetic timeline', big: null, title: c.title, desc: c.description, accent: g.accent, mode: 'timeline' }
      : { out: `revelation-${c.n}`, eyebrow: `Part ${part.numeral} · ${g.title}`, big: String(c.n), title: c.title, desc: c.description, accent: g.accent, mode: 'chapter', n: c.n };
  }),
];

await mkdir(here('../public/og'), { recursive: true });
for (const j of jobs) {
  const titleSize = j.mode === 'timeline' ? 60 : j.title.length > 34 ? 64 : 76;
  const left =
    j.mode === 'home'
      ? h('div', { display: 'flex', flexDirection: 'column' }, [
          h('div', { fontSize: 20, letterSpacing: 5, textTransform: 'uppercase', color: '#7a5f2e', marginBottom: 10 }, j.eyebrow),
          h('div', { fontFamily: 'Cormorant', fontWeight: 300, fontSize: 150, lineHeight: 0.95, letterSpacing: -4 }, j.big),
          h('div', { fontFamily: 'Cormorant', fontStyle: 'italic', fontSize: 44, color: '#7a5f2e', marginTop: 14 }, j.title),
          h('div', { fontSize: 25, color: '#4a463e', marginTop: 18, lineHeight: 1.35, maxWidth: 600 }, j.desc),
        ])
      : h('div', { display: 'flex', flexDirection: 'column' }, [
          h('div', { display: 'flex', alignItems: 'center', gap: 14, fontSize: 19, letterSpacing: 4.5, textTransform: 'uppercase', color: j.accent, marginBottom: 14 }, [
            h('div', { width: 11, height: 11, background: j.accent, transform: 'rotate(45deg)' }),
            j.eyebrow,
          ]),
          j.mode === 'chapter'
            ? h('div', { fontSize: 24, letterSpacing: 5, textTransform: 'uppercase', color: '#4a463e', marginBottom: 6 }, `Revelation ${j.n}`)
            : null,
          h('div', { fontFamily: 'Cormorant', fontWeight: 300, fontSize: titleSize, lineHeight: 1.0, letterSpacing: -1.2, maxWidth: 640 }, j.title),
          h('div', { fontSize: 24, color: '#4a463e', marginTop: 18, lineHeight: 1.35, maxWidth: 600 }, j.desc),
        ].filter(Boolean));

  const right =
    j.mode === 'chapter'
      ? h('div', { display: 'flex', position: 'absolute', right: 70, bottom: -40, fontFamily: 'Cormorant', fontWeight: 300, fontSize: 520, lineHeight: 1, color: '#a8864b', letterSpacing: -20 }, j.big)
      : j.mode === 'timeline'
        ? h('div', { display: 'flex', position: 'absolute', right: 110, top: 150 }, [{ type: 'img', props: { src: star(330, '#a8864b'), width: 330, height: 330 } }])
        : h('div', { display: 'flex', position: 'absolute', right: 90, bottom: 0, width: 380, height: 560 }, [{ type: 'img', props: { src: arch, width: 380, height: 560 } }]);

  const tree = h('div', { width: 1200, height: 630, display: 'flex', position: 'relative', overflow: 'hidden', fontFamily: 'Garamond', color: '#16140f', backgroundImage: 'radial-gradient(circle at 80% 20%, #fffaf0 0%, #f7f4ee 55%, #efeae0 100%)' }, [
    right,
    h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px 0 58px 76px', width: 760 }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'Cormorant', fontWeight: 500, fontSize: 32 }, [
        { type: 'img', props: { src: star(34, '#a8864b'), width: 34, height: 34 } },
        'Revelation Study',
      ]),
      left,
      h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
        h('div', { width: 64, height: 2, background: j.accent }),
        h('div', { fontSize: 19, letterSpacing: 4.5, textTransform: 'uppercase', color: '#5f5a50' }, 'revstudy.sathwiksangeetham.com'),
      ]),
    ]),
  ]);

  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  const jpg = await sharp(png).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  await writeFile(here(`../public/og/${j.out}.jpg`), jpg);
  console.log(`✓ public/og/${j.out}.jpg (${Math.round(jpg.length / 1024)} kB)`);
}
