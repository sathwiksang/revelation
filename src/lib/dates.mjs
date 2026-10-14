// Dates from the git history of the original pages in source/ (they keep their history
// through the move into source/). Used for the sitemap and for each page's structured data.
import { execFileSync } from 'node:child_process';

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const fileFor = (path) => {
  if (path === '/' || path === '') return 'source/revelation_study_chapter1.html';
  if (path === '/timeline') return 'source/timeline.html';
  const m = path.match(/^\/revelation-(\d+)$/);
  return m ? `source/revelation_study_chapter${m[1]}.html` : '';
};

/** ISO date of the last change to the page's text, or '' when unknown. */
export function lastModified(path) {
  const file = fileFor(path);
  return file ? git('log', '-1', '--follow', '--diff-filter=AM', '--format=%cI', '--', file) : '';
}

/** ISO date the page's text was first published. */
export function firstPublished(path) {
  const file = fileFor(path);
  if (!file) return '';
  const all = git('log', '--follow', '--format=%cI', '--', file).split('\n').filter(Boolean);
  return all.at(-1) ?? '';
}
