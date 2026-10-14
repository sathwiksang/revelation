// A plain-text map of the study for language-model tools (https://llmstxt.org).
import type { APIRoute } from 'astro';
import { chapters } from '../lib/study';
import { loadFigures } from '../lib/figures';
import { SITE } from '../site';

export const GET: APIRoute = async () => {
  const all = chapters(await loadFigures());
  const line = (c: (typeof all)[number]) =>
    `- [${c.n === 0 ? c.heading : `Revelation ${c.n}: ${c.title}`}](${SITE.url}${c.href}): ${c.description}`;
  const body = `# ${SITE.name}

> ${SITE.description}

By ${SITE.author} (${SITE.authorUrl}). Scripture in the study is quoted from the New King James Version unless noted.

## The timeline

${line(all[0]!)}

## The chapters

${all.slice(1).map(line).join('\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
