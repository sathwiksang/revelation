/**
 * The study, read straight from the original pages in source/ at build time.
 *
 * Nothing here is retyped: every word on the site comes from those files. This module only
 * gives the words their typesetting (curly quotes, en dashes in ranges), wraps them in
 * structure (verse sections, application panels, the sources), and wires the footnote
 * numbers to the sources they name. scripts/verify.mjs proves afterwards that every word of
 * every original page is present, in order, on the built site.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { partOf, type Part, type Group } from './parts';

const SOURCE = join(process.cwd(), 'source');
const read = (file: string) => readFileSync(join(SOURCE, file), 'utf8');

export interface TocItem {
  id: string;
  level: 2 | 3;
  /** The heading's full text. */
  text: string;
  /** The verse reference part, when the heading starts with one ("Revelation 4:1", "Verses 1–2"). */
  ref?: string;
  /** The title part after the reference. */
  title?: string;
  /** A heading's subtitle after a dash ("The Letter to Ephesus (Revelation 2:1–7) – “Thou Hast Left Thy First Love”"). */
  sub?: string;
}

export interface Chapter {
  /** 1–22, or 0 for the timeline. */
  n: number;
  slug: string;
  href: string;
  file: string;
  /** The page's own heading and subtitle, e.g. "Revelation Chapter 4" / "Personal Study on Revelation 4". */
  heading: string;
  subtitle: string;
  /** From the chapter list: the card's title and description. */
  title: string;
  description: string;
  html: string;
  /** The study's own opening words (first paragraph, notes removed), for search descriptions. */
  excerpt: string;
  toc: TocItem[];
  words: number;
  minutes: number;
  /** Distinct web sources the chapter cites (by URL). */
  citations: string[];
  part: Part;
  group: Group;
}

export interface Card {
  number: string;
  title: string;
  description: string;
}

/* ────────────────────────────────────────────────────────────────────────── */

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const BLOCKS = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'FIGCAPTION', 'DT', 'DD', 'TD', 'TH']);

/** The chapter cards, from the original chapter list (source/revelation_study_chapter1.html). */
export const cards: Card[] = (() => {
  const { document } = parseHTML(read('revelation_study_chapter1.html'));
  return [...document.querySelectorAll('#chaptersPage .chapter-card')].map((card) => ({
    number: squash(card.querySelector('.chapter-number')?.textContent ?? ''),
    title: smart(squash(card.querySelector('.chapter-title')?.textContent ?? '')),
    description: smart(squash(card.querySelector('.chapter-description')?.textContent ?? '')),
  }));
})();

/** The original list page's own heading ("Chapters" / "Select a chapter to begin your study"). */
export const chaptersHeader = (() => {
  const { document } = parseHTML(read('revelation_study_chapter1.html'));
  const h = document.querySelector('#chaptersPage .chapters-header');
  return { heading: squash(h?.querySelector('h1')?.textContent ?? ''), subtitle: squash(h?.querySelector('p')?.textContent ?? '') };
})();

/** The original home page: title, subtitle and button. */
export const home = (() => {
  const { document } = parseHTML(read('index.html'));
  return {
    title: squash(document.querySelector('.hero-content h1')?.textContent ?? ''),
    subtitle: squash(document.querySelector('.hero-content .subtitle')?.textContent ?? ''),
    cta: squash(document.querySelector('.hero-content .cta-button')?.textContent ?? ''),
  };
})();

/* ── Typesetting ─────────────────────────────────────────────────────────── */

/**
 * Curly quotes and proper dashes, in place, one character for one character.
 * A quotation mark opens after a space or an opening bracket — unless nothing follows it but a
 * space or punctuation, in which case it closes (the source sometimes has a stray space before a
 * closing mark: “… to come ” 5).
 */
function smartChars(s: string[]) {
  const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
  const opens = (c: string | undefined) => c === undefined || /[\s([{\u2014\u2013\-/‘“]/.test(c);
  const ends = (c: string | undefined) => c === undefined || /[\s.,;:!?)\]]/.test(c);
  for (let i = 0; i < s.length; i++) {
    const c = s[i], prev = s[i - 1], next = s[i + 1];
    if (c === '"') s[i] = opens(prev) && !ends(next) ? '“' : '”';
    else if (c === "'") {
      if (isWord(prev)) s[i] = '’';
      else if (opens(prev) && !ends(next)) s[i] = /\d/.test(next ?? '') ? '’' : '‘';
      else s[i] = '’';
    } else if (c === '-') {
      if (prev === ' ' && next === ' ') s[i] = '–';
      else if (/\d/.test(prev ?? '') && /\d/.test(next ?? '')) s[i] = '–';
    }
  }
}

/** The same typesetting for a plain string (titles, descriptions). */
export function smart(text: string): string {
  const s = [...text];
  smartChars(s);
  return s.join('').replace(/\.\.\./g, '…');
}

/**
 * Curly quotes and proper dashes, one character for one character, so the words never change.
 * Works on a whole block at once so a quotation that opens in one element and closes in another
 * still gets the right marks.
 */
function typesetBlock(texts: Text[]) {
  const skip = (t: Text) => /:\/\//.test(t.data) || !!t.parentElement?.closest('a');
  const parts = texts.map((t) => (skip(t) ? 'x'.repeat(t.data.length) : t.data));
  const s = parts.join('').split('');
  smartChars(s);
  let at = 0;
  texts.forEach((t, k) => {
    const len = parts[k]!.length;
    if (!skip(t)) t.data = s.slice(at, at + len).join('').replace(/\.\.\./g, '…');
    at += len;
  });
}

function typeset(root: Element) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const byBlock = new Map<Element, Text[]>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    let b: Element | null = t.parentElement;
    while (b && b !== root && !BLOCKS.has(b.tagName)) b = b.parentElement;
    const key = b ?? root;
    if (!byBlock.has(key)) byBlock.set(key, []);
    byBlock.get(key)!.push(t);
  }
  for (const texts of byBlock.values()) typesetBlock(texts);
}

/* ── Clean-up ────────────────────────────────────────────────────────────── */

function clean(root: Element) {
  const doc = root.ownerDocument;
  // Comments (the "Content from … starts here" notes) are not part of the page.
  const walker = doc.createTreeWalker(root, 128 /* SHOW_COMMENT */);
  const comments: Node[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) comments.push(n);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  for (const el of [...root.querySelectorAll('*')]) {
    const cls = el.getAttribute('class') ?? '';
    const href = el.getAttribute('href');
    const keep: Record<string, string> = {};
    if (el.tagName === 'SPAN' && /\b(verse-number|bible-verse)\b/.test(cls)) keep.class = 'q';
    if (el.tagName === 'A' && href) {
      keep.href = href;
      if (/^https?:/.test(href)) Object.assign(keep, { target: '_blank', rel: 'noopener' });
    }
    if (el.tagName === 'IMG') {
      keep.alt = el.getAttribute('alt') ?? '';
    }
    if (/\bimage-placeholder\b/.test(cls)) keep['data-placeholder'] = '';
    if (/\bsources-list\b/.test(cls)) keep['data-sources-list'] = '';
    for (const a of [...el.attributes]) el.removeAttribute(a.name);
    for (const [k, v] of Object.entries(keep)) el.setAttribute(k, v);
  }

  // Collapse the source file's line-wrapping whitespace.
  const tw = doc.createTreeWalker(root, 4);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) (n as Text).data = (n as Text).data.replace(/\s+/g, ' ');
}

/* ── Headings ────────────────────────────────────────────────────────────── */

const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72).replace(/-+$/, '');

// A verse reference: "Revelation 4:2–3", "Revelation Chapter 7", "Verses 17b-19", "Verse 23 (continued)".
const N = String.raw`\d+[ab]?`;
const SPAN = String.raw`${N}(?:\s*[–-]\s*${N})?`;
const LIST = String.raw`${SPAN}(?:,\s*${SPAN})*`;
const REF_PART = String.raw`(?:Revelation\s+(?:Chapter\s+)?\d+(?::${LIST})?|Verses?\s+${LIST})(?:\s*\(continued\))?`;
/** "Revelation 4:1 – A Door Open in Heaven", "Verses 1–2: Measuring…", "Verses 7–10 The Locusts’…". */
const REF = new RegExp(String.raw`^(${REF_PART})(?:(\s*[–-]\s*|:\s+|\s+(?=[A-Z“‘]))(.+))?$`);
/** "The Letter to Ephesus (Revelation 2:1–7) – “Thou Hast Left Thy First Love”". */
const TITLE_REF = /^(.+?)(\s+\()(Revelation\s+\d+:[^)]+)(\))(?:(\s*[–-]\s*)(.+))?$/;

/**
 * Sets a heading's parts apart — the verse reference, the title, a subtitle — by wrapping its own
 * words in spans (the words and their order are unchanged). A closing colon is kept but not shown.
 */
function splitHeading(h: Element): { ref?: string; title?: string; sub?: string } {
  if (h.children.length) return {};
  const text = (h.textContent ?? '').trim();
  const doc = h.ownerDocument;
  const span = (cls: string, t: string) => {
    const el = doc.createElement('span');
    el.className = cls;
    if (/:$/.test(t) && cls !== 'h-sep' && cls !== 'h-paren') {
      el.append(t.slice(0, -1));
      const c = doc.createElement('span');
      c.className = 'h-colon';
      c.textContent = ':';
      el.append(c);
    } else el.textContent = t;
    return el;
  };
  let m = text.match(REF);
  if (m) {
    const [, ref = '', sep = '', title = ''] = m;
    h.textContent = '';
    h.append(span('h-ref', ref));
    if (title) h.append(span('h-sep', sep), span('h-title', title));
    return { ref: ref.replace(/:$/, ''), title: title ? title.replace(/:$/, '') : undefined };
  }
  m = text.match(TITLE_REF);
  if (m) {
    const [, title = '', open = '', ref = '', close = '', sep = '', sub = ''] = m;
    h.textContent = '';
    h.classList.add('h-split');
    h.append(span('h-title', title), span('h-paren', open), span('h-ref', ref), span('h-paren', close));
    if (sub) h.append(span('h-sep', sep), span('h-sub', sub));
    return { ref, title, sub: sub ? sub.replace(/:$/, '') : undefined };
  }
  if (/:$/.test(text)) {
    h.textContent = '';
    h.append(text.slice(0, -1), span('h-colon', ':'));
  }
  return {};
}

const isSourcesHeading = (el: Element) => /^H[23]$/.test(el.tagName) && /^sources\b/i.test((el.textContent ?? '').trim());
const isApplication = (el: Element) =>
  el.tagName === 'H3' && /^(personal|devotional|application)\b/i.test((el.textContent ?? '').trim());

/* ── Footnotes ───────────────────────────────────────────────────────────── */

const NUMS = /^[\s\d,[\]]+$/;
/** A superscript that holds only note numbers: “14”, “11 12”, “[10]”. */
const isNums = (s: string) => NUMS.test(s) && /\d/.test(s);
const numbers = (s: string) => [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
function expand(spec: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(/,/)) {
    const r = part.match(/(\d+)\s*[–-]\s*(\d+)/);
    if (r) for (let i = Number(r[1]); i <= Number(r[2]); i++) out.push(i);
    else out.push(...numbers(part));
  }
  return out;
}

/** The first meaningful child node of an element (skipping whitespace). */
function firstChild(el: Element): ChildNode | undefined {
  return [...el.childNodes].find((n) => n.nodeType !== 3 || (n as Text).data.trim() !== '');
}

/* ── Figures ─────────────────────────────────────────────────────────────── */

export interface FigureRender {
  /** Replace an image placeholder with real markup. Receives the placeholder's caption text. */
  (key: 'plate' | 'map', caption: string, alt?: string): string;
}

/* ── Verses and run-in heads ─────────────────────────────────────────────── */

/** Text.splitText, which linkedom lacks: keeps the first `at` characters and returns the rest. */
function splitText(t: Text, at: number): Text {
  const rest = t.ownerDocument.createTextNode(t.data.slice(at));
  t.data = t.data.slice(0, at);
  t.after(rest);
  return rest;
}

/**
 * Wraps the part of `parent`'s text between two character offsets in a span, splitting text at
 * the edges. Returns null (and changes nothing) when an edge falls inside a child element.
 */
function wrapText(parent: Element, start: number, end: number, cls: string): Element | null {
  const cut = (at: number): boolean => {
    let pos = 0;
    for (const c of [...parent.childNodes]) {
      const len = (c.textContent ?? '').length;
      if (at === pos || at === pos + len) return true;
      if (at > pos && at < pos + len) {
        if (c.nodeType !== 3) return false;
        splitText(c as Text, at - pos);
        return true;
      }
      pos += len;
    }
    return at === pos;
  };
  if (end <= start) return null;
  // Check both edges before splitting anything.
  const edges = (at: number) => {
    let pos = 0;
    for (const c of parent.childNodes) {
      const len = (c.textContent ?? '').length;
      if (at > pos && at < pos + len && c.nodeType !== 3) return false;
      pos += len;
    }
    return true;
  };
  if (!edges(start) || !edges(end) || !cut(start) || !cut(end)) return null;
  const take: ChildNode[] = [];
  let pos = 0;
  for (const c of [...parent.childNodes]) {
    const len = (c.textContent ?? '').length;
    if (pos >= start && pos + len <= end && len > 0) take.push(c);
    pos += len;
  }
  if (!take.length) return null;
  const el = parent.ownerDocument.createElement('span');
  el.className = cls;
  take[0]!.before(el);
  el.append(...take);
  return el;
}

/** The index just past the quotation mark that closes the one opening at `i`, or -1. */
function closeQuote(t: string, i: number): number {
  let depth = 0;
  for (let k = i; k < t.length; k++) {
    if (t[k] === '“') depth++;
    else if (t[k] === '”' && --depth === 0) return k + 1;
  }
  return -1;
}

/** "Revelation 2:7:", "Verse 1:", "Verses 5b-6:", "Revelation 12:4 (continued):", "Verses 14–16 (The Grain Harvest – …):", "Text:". */
const VERSE_LABEL = new RegExp(String.raw`^(?:Revelation\s+\d+:${LIST}|Verses?\s+${LIST}|Text)(?:\s*\((?:continued|[^()]{3,60})\))?:`);
/** A reference closing a quoted verse: " (21:2)", " (Revelation 13:1–2).", " (v. 4)". */
const VERSE_CITE = /^\s*\((?:(?:Rev(?:elation)?\.?|vv?\.)\s*)?\d+(?::\d+)?[^()]{0,24}\)\.?/;

/**
 * Verse-by-verse paragraphs. Where the study marks a paragraph's opening — a verse label
 * (“Revelation 2:7:”) and the verse it quotes, or the quoted verse alone — the label, the verse
 * and the commentary are set apart: the label above, the verse as Scripture, the comment beneath.
 * The paragraph's words are untouched; they are only grouped.
 */
function verseBlocks(body: Element, sources: Element | null) {
  for (const p of [...body.querySelectorAll('p')]) {
    if (sources?.contains(p)) continue;
    const first = firstChild(p);
    if (!first || first.nodeType !== 1 || !(first as Element).classList.contains('q')) continue;
    const text = p.textContent ?? '';
    const lead = text.length - text.trimStart().length;
    const label = text.slice(lead).match(VERSE_LABEL);
    let at = lead + (label ? label[0].length : 0);
    at += text.slice(at).length - text.slice(at).trimStart().length;

    // The verse: a quotation right at the start that ends a sentence (one that runs on into the
    // writer's own sentence stays where it is).
    let verse: [number, number, number] | null = null; // start, end of the words, end with reference
    if (text[at] === '“') {
      const end = closeQuote(text, at);
      if (end > 0) {
        const cite = text.slice(end).match(VERSE_CITE);
        const stop = end + (cite ? cite[0].length : 0);
        const next = text.slice(stop).trimStart()[0];
        if (end - at > 24 && (!next || !/[a-z,;:]/.test(next))) verse = [at, end, stop];
      }
    }
    if (!label && !verse) continue;

    // The marked span is opened up so its words can be regrouped.
    const s = first as Element;
    s.replaceWith(...s.childNodes);
    p.classList.add('vp');
    if (label) {
      const l = wrapText(p, lead, lead + label[0].length, 'v-label');
      const last = l?.lastChild;
      if (l && last?.nodeType === 3 && /:$/.test((last as Text).data)) {
        const colon = splitText(last as Text, (last as Text).data.length - 1);
        const c = p.ownerDocument.createElement('span');
        c.className = 'v-colon';
        colon.replaceWith(c);
        c.append(colon);
      }
    }
    if (verse) {
      const [a, b, c] = verse;
      const v = wrapText(p, a, c, 'v-text');
      if (v && c > b) wrapText(v, b - a, c - a, 'v-cite');
      if (v) {
        const after = text.slice(c);
        const dash = after.match(/^\s*[–—-]\s+/);
        if (dash) wrapText(p, c, c + dash[0].length, 'v-dash');
        // Nothing after the verse but its note numbers: the paragraph is the verse.
        if (/^[\s\d[\],.]*$/.test(after)) p.classList.add('vp-only');
      }
    }
  }
}

const SMALL = new Set('a an and as at but by for from in into is it its of on or the to with like has are be his her their not no than over under up upon will was were who shall'.split(' '));
/** "Trust in God’s Justice", "The Lamb Will Stand on Zion", "Wall of Jasper". */
const titleCase = (s: string) => {
  const w = s.split(/\s+/);
  return w.length <= 9 && /^[A-Z“‘(]/.test(w[0] ?? '') && w.every((x, i) => i === 0 || !/^[a-z]/.test(x) || SMALL.has(x.replace(/[^a-z]/g, '')));
};
/** Lead-ins the study uses for its own asides. */
const ASIDE = /^(?:Personal\s+(?:[Aa]pplication|[Rr]eflection|lessons|encouragement and application)(?:\s*\([^)]*\))?|Application(?:\s+for us|\/Significance)?|Another (?:angle|reflection|layer|application|possible nuance|personal lesson|doctrinal point)|Spiritual (?:significance|condition)|Symbolic (?:note|significance)|Theological note|Plymouth Brethren perspective)$/;
const APPLIED = /^(?:Personal\s+(?:[Aa]pplication|[Rr]eflection|lessons|encouragement)|Application(?![\w/])|Application for us|Another application)/;

/**
 * Run-in heads: a paragraph or list item that opens with a short title and a colon
 * (“Doctrine:”, “Wall of Jasper:”) has that title set in the text's semibold. Paragraphs that
 * open “Personal Application:” are set as the study's application notes.
 */
function runIns(body: Element, sources: Element | null) {
  for (const el of [...body.querySelectorAll('p, li')]) {
    if (sources?.contains(el) || el.classList.contains('vp')) continue;
    const first = firstChild(el);
    if (!first) continue;
    if (first.nodeType === 1) {
      // A marked reference used as the item's label (“1 Thessalonians 4:16–17 – …”, “Satan Bound: …”).
      const f = first as Element;
      const next = f.nextSibling;
      if (f.classList.contains('q') && next?.nodeType === 3 && /^\s*(?::|[–-]\s)/.test((next as Text).data)) f.classList.add('runin');
      continue;
    }
    const t = first as Text;
    const lead = t.data.length - t.data.trimStart().length;
    const m = t.data.slice(lead).match(/^([^:.!?“”;,]{2,60}):(?=\s)/);
    if (!m) continue;
    const phrase = m[1]!.trim();
    const words = phrase.split(/\s+/).length;
    if (phrase.startsWith('(') || !(ASIDE.test(phrase) || titleCase(phrase) || (el.tagName === 'LI' && words <= 8))) continue;
    const head = lead ? splitText(t, lead) : t;
    splitText(head, m[0].length);
    const colon = splitText(head, m[0].length - 1);
    const span = el.ownerDocument.createElement('span');
    span.className = 'runin';
    const c = el.ownerDocument.createElement('span');
    c.className = 'r-colon';
    head.replaceWith(span);
    colon.replaceWith(c);
    c.append(colon);
    span.append(head, c);
    if (el.tagName === 'P' && APPLIED.test(phrase) && !el.closest('.apply')) el.classList.add('applied');
  }
}

/* ── The chapters ────────────────────────────────────────────────────────── */

function build(n: number, file: string, pageId: string, figures: FigureRender): Chapter {
  const { document } = parseHTML(read(file));
  const page = document.getElementById(pageId);
  if (!page) throw new Error(`${file}: #${pageId} not found`);
  const heading = smart(squash(page.querySelector('.content-header h1')?.textContent ?? ''));
  const subtitle = smart(squash(page.querySelector('.content-header p')?.textContent ?? ''));
  const body = page.querySelector('.content-body');
  if (!body) throw new Error(`${file}: no .content-body`);

  clean(body);
  typeset(body);

  // Image placeholders become real figures.
  for (const ph of [...body.querySelectorAll('[data-placeholder]')]) {
    const img = ph.querySelector('img');
    const holder = document.createElement('div');
    if (img) {
      // The study's caption stays as written; the placeholder image's alt text names the map.
      const caption = squash([...ph.querySelectorAll('p')].map((p) => p.textContent ?? '').join(' '));
      holder.innerHTML = figures('map', caption, img.getAttribute('alt') ?? '');
    } else {
      const text = squash(ph.textContent ?? '').replace(/^\[Image:\s*/, '').replace(/\]$/, '');
      holder.innerHTML = figures('plate', text);
    }
    ph.replaceWith(...holder.childNodes);
  }

  // The sources: from the "Sources…" heading (or the first sources list) to the end.
  const top = [...body.children];
  let start = top.findIndex(isSourcesHeading);
  const listAt = top.findIndex((el) => el.hasAttribute('data-sources-list'));
  // Some chapters have no "Sources" heading, only a sources list after the conclusion.
  if (listAt >= 0 && (start < 0 || listAt < start)) start = listAt;
  let sources: Element | null = null;
  if (start >= 0) {
    sources = document.createElement('section');
    sources.className = 'sources';
    sources.id = 'sources';
    top[start]!.before(sources);
    for (const el of top.slice(start)) sources.append(el);
  }

  // Note definitions: list items or paragraphs in the sources that begin with their numbers.
  const defs = new Map<number, string>(); // number -> element id
  // Numbers a note lists after its source (“… Darby's Bible Synopsis ³ ⁴ ⁸”): used when no note leads with them.
  const more = new Map<number, string>();
  let k = 0;
  if (sources) {
    for (const item of [...sources.querySelectorAll('li, p')]) {
      const first = firstChild(item);
      if (!first || first.nodeType !== 1) continue;
      const el = first as Element;
      let nums: number[] = [];
      const lead: Element[] = [];
      if (el.tagName === 'SUP') {
        for (let c: ChildNode | null = el; c; c = c.nextSibling) {
          if (c.nodeType === 3 && !(c as Text).data.trim()) continue;
          if (c.nodeType === 1 && (c as Element).tagName === 'SUP' && isNums(c.textContent ?? '')) {
            lead.push(c as Element);
            nums.push(...numbers(c.textContent ?? ''));
          } else break;
        }
      } else if (el.tagName === 'STRONG' && /^References?\s/i.test(el.textContent ?? '')) {
        nums = expand((el.textContent ?? '').replace(/^References?\s*/i, '').replace(/:\s*$/, ''));
        lead.push(el);
      }
      if (!nums.length) continue;
      const id = `note-${++k}`;
      item.id = id;
      item.classList.add('def');
      item.setAttribute('data-nums', nums.join(' '));
      for (const l of lead) l.classList.add('def-num');
      // Gather the leading numbers (with the spaces between them) into one row.
      if (lead.length && lead[0]!.tagName === 'SUP') {
        const row = document.createElement('span');
        row.className = 'nums';
        lead[0]!.before(row);
        const last = lead.at(-1)!;
        for (let c: ChildNode | null = row.nextSibling; c; ) {
          const next: ChildNode | null = c.nextSibling;
          row.append(c);
          if (c === last) break;
          c = next;
        }
      }
      for (const num of nums) if (!defs.has(num)) defs.set(num, id);
      for (const s of [...item.querySelectorAll('sup')]) {
        if (lead.includes(s) || !isNums(s.textContent ?? '')) continue;
        s.classList.add('def-num', 'def-more');
        for (const num of numbers(s.textContent ?? '')) if (!more.has(num)) more.set(num, id);
      }
    }
    for (const [num, id] of more) if (!defs.has(num)) defs.set(num, id);
    // Bare web addresses in the notes become links (the text stays exactly as written).
    const walker = document.createTreeWalker(sources, 4);
    const bare: Text[] = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (/https?:\/\//.test((t as Text).data) && !t.parentElement?.closest('a')) bare.push(t as Text);
    for (const t of bare) {
      const holder = document.createElement('span');
      holder.innerHTML = t.data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
      t.replaceWith(...holder.childNodes);
    }
  }

  // Footnote markers in the text: each number links to the note that names it.
  for (const sup of [...body.querySelectorAll('sup')]) {
    if (sup.classList.contains('def-num') || !isNums(sup.textContent ?? '')) continue;
    const text = sup.textContent ?? '';
    // Without a list of sources (Revelation 2 and 3) the numbers stay, quietly, as written.
    sup.className = sources ? 'fn' : 'fn plain';
    // The source puts a space before most note numbers. It stays in the text, inside the
    // superscript and set without width, so the number sits on its word.
    const before = sup.previousSibling;
    let lead = '';
    if (before && before.nodeType === 3 && / $/.test((before as Text).data)) {
      (before as Text).data = (before as Text).data.replace(/ $/, '');
      lead = '<span class="fn-gap"> </span>';
    }
    // Brackets (“[10]”) are kept but not shown, so every chapter's numbers look alike.
    const marks = text.replace(/[[\]]/g, (b) => `<span class="fn-br">${b}</span>`);
    if (!sources) {
      sup.innerHTML = lead + marks;
      continue;
    }
    sup.innerHTML = lead + marks.replace(/\d+/g, (d) => {
      const id = defs.get(Number(d));
      return id ? `<a href="#${id}" data-n="${d}">${d}</a>` : `<a href="#sources" data-n="${d}" class="unmapped">${d}</a>`;
    });
  }

  // Headings: anchors, verse references set apart, and the contents list.
  const used = new Set<string>();
  const toc: TocItem[] = [];
  for (const h of [...body.querySelectorAll('h2, h3')]) {
    const text = squash(h.textContent ?? '');
    let id = slugify(text) || 'section';
    for (let i = 2; used.has(id); i++) id = `${slugify(text)}-${i}`;
    used.add(id);
    h.id = id;
    const inSources = !!sources?.contains(h);
    const { ref, title, sub } = inSources ? {} : splitHeading(h);
    if (!inSources) toc.push({ id, level: h.tagName === 'H2' ? 2 : 3, text, ref, title, sub });
    // A link to the section itself (site furniture, not the study's text: marked data-x).
    const a = document.createElement('a');
    a.className = 'anchor';
    a.href = `#${id}`;
    a.setAttribute('aria-label', `Link to “${text}”`);
    a.setAttribute('data-x', '');
    a.innerHTML = '<span aria-hidden="true">#</span>';
    h.append(a);
  }

  // "Personal Application" panels: the heading and everything up to the next heading.
  for (const h of [...body.children].filter((el) => el.tagName === 'H3')) {
    if (!isApplication(h)) continue;
    const panel = document.createElement('section');
    panel.className = 'apply';
    panel.setAttribute('aria-labelledby', h.id);
    h.before(panel);
    for (let c: Element | null = h; c && (c === h || !/^H[23]$/.test(c.tagName)) && c !== sources; ) {
      const next: Element | null = c.nextElementSibling;
      panel.append(c);
      c = next;
    }
  }

  // Verse sections: each h2 with what follows it.
  let current: Element | null = null;
  for (const el of [...body.children]) {
    if (el === sources) break;
    if (el.tagName === 'H2') {
      current = document.createElement('section');
      current.className = 'vs';
      current.setAttribute('aria-labelledby', el.id);
      el.before(current);
    }
    if (current) current.append(el);
  }

  verseBlocks(body, sources);
  runIns(body, sources);

  // The chapter's first paragraph opens with a raised initial (unless it opens with a quotation
  // mark, or with a verse).
  const opener = [...body.querySelectorAll('p')].find((p) => !sources?.contains(p) && squash(p.textContent ?? '').length > 40);
  if (opener && !opener.classList.contains('vp') && !opener.querySelector('.runin') && /^[\p{L}]/u.test(squash(opener.textContent ?? ''))) opener.classList.add('opener');

  // Word count (the study itself, not its sources).
  const studyText = [...body.children].filter((el) => el !== sources).map((el) => el.textContent ?? '').join(' ');
  const words = studyText.split(/\s+/).filter(Boolean).length;

  const firstP = [...body.querySelectorAll('p')].find((p) => !sources?.contains(p) && squash(p.textContent ?? '').length > 80);
  let excerpt = '';
  if (firstP) {
    const copy = firstP.cloneNode(true) as Element;
    copy.querySelectorAll('sup, [data-x]').forEach((x) => x.remove());
    excerpt = squash(copy.textContent ?? '');
  }

  const citations = [...new Set([...(sources ?? body).querySelectorAll('a[href^="http"]')].map((a) => a.getAttribute('href')!))];

  const card = cards.find((c) => Number(c.number) === n);
  if (!card) throw new Error(`No chapter card for ${n}`);
  const { part, group } = partOf(n);

  // A short contents list: the h2 sections, or every heading when a chapter is built on h3s.
  const h2s = toc.filter((t) => t.level === 2);
  const contents = h2s.length >= 4 ? h2s : toc.filter((t) => !/^(personal|devotional|application)\b/i.test(t.text));

  return {
    n,
    slug: n === 0 ? 'timeline' : `revelation-${n}`,
    href: n === 0 ? '/timeline' : `/revelation-${n}`,
    file,
    heading,
    subtitle,
    title: card.title,
    description: card.description,
    html: body.innerHTML,
    excerpt,
    toc: contents,
    words,
    minutes: Math.max(1, Math.round(words / 230)),
    citations,
    part,
    group,
  };
}

let memo: Chapter[] | undefined;
export function chapters(figures: FigureRender): Chapter[] {
  if (memo) return memo;
  const list: Chapter[] = [build(0, 'timeline.html', 'timelinePage', figures)];
  for (let n = 1; n <= 22; n++) list.push(build(n, `revelation_study_chapter${n}.html`, `chapter${n}Page`, figures));
  return (memo = list);
}
