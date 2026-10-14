/** Site-wide facts. Change them here and they change everywhere. */
export const SITE = {
  name: 'Revelation Study',
  url: 'https://revstudy.sathwiksangeetham.com',
  title: 'Revelation Study — An In-Depth Study & Commentary on the Book of Revelation',
  description:
    'A verse-by-verse study and commentary on the Book of Revelation, chapters 1 to 22, with a dispensational timeline from the Rapture to the Great White Throne, drawing on J. N. Darby, William Kelly, C. H. Mackintosh and John Walvoord.',
  locale: 'en',
  author: 'Sathwik Sangeetham',
  authorUrl: 'https://sathwiksangeetham.com',
  email: 'contact@sathwiksangeetham.com',
  repo: 'https://github.com/sathwiksang/revelation',
} as const;

/** The study quotes the New King James Version unless a chapter says otherwise. */
export const NKJV_NOTICE =
  'Scripture quotations in the study, unless otherwise noted, are taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.';
