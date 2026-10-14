/**
 * The two pictures the study asked for, in place of its image placeholders:
 * – Revelation 1: the engraving its placeholder describes (Schnorr von Carolsfeld, 1860, public domain);
 * – Revelation 2: a map of the seven churches of Asia (drawn by scripts/map.mjs from Natural Earth).
 * Captions keep the study's own words; anything the site adds is marked data-x.
 */
import { getImage } from 'astro:assets';
import plate from '../assets/plates/schnorr-236.png';
import map from '../assets/seven-churches.svg?raw';
import type { FigureRender } from './study';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let memo: FigureRender | undefined;

export async function loadFigures(): Promise<FigureRender> {
  if (memo) return memo;
  const widths = [560, 860, 1099];
  const sizes = '(min-width: 64rem) 46rem, calc(100vw - 2rem)';
  // A woodcut is line art: AVIF keeps it crisp and small; the original PNG is the fallback.
  const avif = await getImage({ src: plate, format: 'avif', widths, sizes, quality: 62 });
  const png = await getImage({ src: plate, format: 'png', width: 1099 });

  const picture = `<picture>
    <source type="image/avif" srcset="${avif.srcSet.attribute}" sizes="${sizes}">
    <img src="${png.src}" width="1099" height="890" loading="lazy" decoding="async" alt="Woodcut: the glorified Lord, in a long robe with a golden girdle and holding seven stars, stands among seven golden lampstands while John lies at His feet as though dead.">
  </picture>`;

  memo = (key, caption, alt = '') => {
    if (key === 'plate') {
      return `<figure class="plate">
        <div class="plate-frame">${picture}</div>
        <figcaption><span class="cap">${esc(caption)}</span><span class="credit" data-x>Julius Schnorr von Carolsfeld, <i>Die Bibel in Bildern</i> (1860), plate 236. Public domain.</span></figcaption>
      </figure>`;
    }
    return `<figure class="map">
      <div class="map-frame" data-x>${map.replace('<title id="map-title">Map of the seven churches in Asia Minor</title>', `<title id="map-title">${esc(alt)}</title>`)}</div>
      <figcaption><span class="cap">${esc(caption)}</span><span class="credit" data-x>The churches are numbered in the order of the letters; the star marks Patmos (Revelation 1:9). Coastline from Natural Earth (public domain).</span></figcaption>
    </figure>`;
  };
  return memo;
}
