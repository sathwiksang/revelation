// Edge entry point for revstudy.sathwiksangeetham.com.
// Canonicalises every request to https://revstudy.sathwiksangeetham.com, sends the old page
// addresses (from the original static site) to their new homes, then serves the built site
// from the static assets binding (./dist).
const CANONICAL_HOST = 'revstudy.sathwiksangeetham.com';

/** The original site's file names → the new addresses. */
function legacy(pathname) {
  if (pathname === '/index.html') return '/';
  if (pathname === '/timeline.html') return '/timeline';
  if (pathname === '/revelation_chapter1.pdf') return '/revelation-1.pdf';
  const m = pathname.match(/^\/revelation_study_chapter(\d{1,2})\.html$/);
  if (m && +m[1] >= 1 && +m[1] <= 22) return `/revelation-${+m[1]}`;
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const moved = legacy(url.pathname);
    if (moved) return Response.redirect(`https://${CANONICAL_HOST}${moved}${url.search}`, 301);

    return env.ASSETS.fetch(request);
  },
};
