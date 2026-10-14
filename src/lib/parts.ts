/**
 * How the book unfolds, after its own division in Revelation 1:19 — what John had seen, the
 * things that are, and the things about to be after these — with the chapters grouped within.
 * These are the site's own headings for finding one's way; the study's words are untouched.
 */
export interface Group {
  key: string;
  title: string;
  chapters: number[];
  /** Accent colour for the group: a stone or metal from the book itself. */
  accent: string;
  /** What the accent is, for the record. */
  stone: string;
}

export interface Part {
  numeral: string;
  key: string;
  /** Words from Revelation 1:19 (JND), quoted from the data, never typed. */
  phrase: string;
  groups: Group[];
}

export const PARTS: Part[] = [
  {
    numeral: 'I',
    key: 'seen',
    phrase: 'what thou hast seen',
    groups: [{ key: 'vision', title: 'The Son of man in the midst', chapters: [1], accent: '#8a6a2c', stone: 'fine brass (1:15)' }],
  },
  {
    numeral: 'II',
    key: 'are',
    phrase: 'the things that are',
    groups: [{ key: 'churches', title: 'The seven assemblies', chapters: [2, 3], accent: '#9a6f24', stone: 'the golden lampstands (1:20)' }],
  },
  {
    numeral: 'III',
    key: 'after',
    phrase: 'the things that are about to be after these',
    groups: [
      { key: 'throne', title: 'The throne and the Lamb', chapters: [4, 5], accent: '#2f6a55', stone: 'a rainbow like an emerald (4:3)' },
      { key: 'seals', title: 'The seven seals', chapters: [6, 7], accent: '#8c2f2b', stone: 'the sardius (4:3)' },
      { key: 'trumpets', title: 'The seven trumpets', chapters: [8, 9, 10, 11], accent: '#7a5a2e', stone: 'the golden altar (8:3)' },
      { key: 'signs', title: 'The woman, the dragon and the beasts', chapters: [12, 13, 14], accent: '#2c4a78', stone: 'the sapphire (21:19)' },
      { key: 'bowls', title: 'The seven bowls', chapters: [15, 16], accent: '#5c3060', stone: 'the amethyst (21:20)' },
      { key: 'babylon', title: 'Babylon the great', chapters: [17, 18], accent: '#7a2440', stone: 'purple and scarlet (17:4)' },
      { key: 'kingdom', title: 'The King and His kingdom', chapters: [19, 20], accent: '#8a6a2c', stone: 'many diadems (19:12)' },
      { key: 'new', title: 'All things new', chapters: [21, 22], accent: '#2d6c78', stone: 'jasper, clear as crystal (21:11)' },
    ],
  },
];

/** The timeline stands before the chapters, as card 00 did. */
export const TIMELINE_GROUP: Group = { key: 'timeline', title: 'The prophetic timeline', chapters: [0], accent: '#8a6a2c', stone: 'gold' };

export function partOf(n: number): { part: Part; group: Group } {
  if (n === 0) return { part: PARTS[2]!, group: TIMELINE_GROUP };
  for (const part of PARTS) for (const group of part.groups) if (group.chapters.includes(n)) return { part, group };
  throw new Error(`No part for chapter ${n}`);
}
