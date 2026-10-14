# Revelation Study

An in-depth study and commentary on the Book of Revelation, chapters 1 to 22, with a dispensational
timeline from the Rapture to the Great White Throne.

**Live:** https://revstudy.sathwiksangeetham.com (short address: https://rev.sathwiksangeetham.com) · compiled by [Sathwik Sangeetham](https://sathwiksangeetham.com)

## How it is built

- `source/` holds the original pages, exactly as they were written (one typo fixed at the author's
  request: the Revelation 18 card's "he collapse" now reads "The collapse"). They are the **only**
  source of the study's text: the site reads them at build time and never retypes a word. The
  original site as it was first published is kept under the tag `original-site`.
- `src/lib/study.ts` turns each original page into a chapter: curly quotes and en dashes (one
  character for one character), verse-reference headings, "Personal Application" panels, the
  sources, and footnote numbers linked to the sources they name.
- `scripts/verify.mjs` runs after every build and proves that every word of every original page is
  on the built site, in order (241,674 words), that the home page carries every chapter card, and
  that every in-page link lands. A difference fails the build.
- The reading page sets each verse the study quotes apart from its commentary, gives application
  notes their own panel, and carries a reader: text size, typeface (Garamond, Literata, Atkinson
  Hyperlegible Next), line spacing, line length, paper, justified text, note numbers and a focus
  mode (`src/components/ReaderSettings.astro`, `src/scripts/reader.ts`). It shows the section you
  are in and the time left, remembers your place, and turns the chapter with ← and →. The settings
  and your place stay in your browser only.
- `src/lib/parts.ts` groups the chapters after Revelation 1:19. Verses that frame the pages are quoted
  from J. N. Darby's translation (`src/data/jnd-revelation.json`, public domain), never typed by hand.

Astro 7 (static), self-hosted fonts, a strict Content Security Policy, and a Cloudflare Worker
(`worker/index.js`) that also redirects the original file names (`revelation_study_chapter4.html`
→ `/revelation-4`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local preview |
| `npm run build` | Type-check, build to `dist/`, verify every word |
| `npm run og` | Regenerate the share images in `public/og/` |
| `node scripts/map.mjs <natural-earth-dir>` | Redraw the map of the seven churches |
| `node scripts/qa.mjs <url> [chromium\|webkit]` | Interaction checks against a running build |
| `npm run deploy` | Build and deploy to Cloudflare |

## Credits

- Engraving (Revelation 1): Julius Schnorr von Carolsfeld, *Die Bibel in Bildern* (1860), plate 236. Public domain.
- Map (Revelation 2): coastline from Natural Earth. Public domain.
- Scripture in the study: New King James Version® unless noted. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.
