/**
 * Revelation in the Darby translation (JND, 1890, public domain), for the site's own words:
 * the verses that frame the pages. Taken from src/data/jnd-revelation.json (copied from the
 * main site's checked dataset), never typed by hand. An unknown verse fails the build.
 */
import data from '../data/jnd-revelation.json';

const { emphasisOpen: EM_OPEN, emphasisClose: EM_CLOSE } = data.meta.markers;

export const TRANSLATION = {
  name: data.meta.translation,
  translator: data.meta.translator,
  abbreviation: data.meta.abbreviation,
  year: data.meta.year,
};

export function verse(chapter: number, v: number): string {
  const text = (data.chapters as (string | null)[][])[chapter - 1]?.[v - 1];
  if (!text) throw new Error(`[scripture] Revelation ${chapter}:${v} is not in the Darby text`);
  return text;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for a verse: [supplied words] in lighter type, emphasis in italic. */
export function verseHtml(chapter: number, v: number): string {
  return esc(verse(chapter, v))
    .replace(/\[([^\]]+)\]/g, '<span class="supplied">$1</span>')
    .replaceAll(EM_OPEN, '<i>')
    .replaceAll(EM_CLOSE, '</i>');
}

/** Plain text of a verse, for meta tags and share images. */
export function verseText(chapter: number, v: number): string {
  return verse(chapter, v).replace(/[[\]]/g, '').replaceAll(EM_OPEN, '').replaceAll(EM_CLOSE, '');
}

/** A phrase that must occur in the verse — used to quote part of a verse safely. */
export function phrase(chapter: number, v: number, words: string): string {
  const plain = verseText(chapter, v);
  if (!plain.includes(words)) throw new Error(`[scripture] "${words}" is not in Revelation ${chapter}:${v} (JND)`);
  return words;
}
