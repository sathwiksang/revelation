/**
 * The reader. Everything on the page works without it; this adds:
 * – reading settings, applied at once and kept in this browser,
 * – where you are: the section, how much is read, how long is left (rail and reading bar),
 * – the contents following your place,
 * – picking up where you left off, here and on the home page,
 * – ← and → to turn to the previous or next chapter, and a focus mode.
 */

type Key = 'size' | 'face' | 'lead' | 'measure' | 'paper' | 'justify' | 'notes' | 'focus';
type Settings = Partial<Record<Key, string>>;
const DEFAULTS: Record<Key, string> = { size: '0', face: 'garamond', lead: 'normal', measure: 'normal', paper: 'vellum', justify: 'off', notes: 'on', focus: 'off' };
const KEYS = Object.keys(DEFAULTS) as Key[];

const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private window, storage blocked: the settings simply last for this page */
    }
  },
};

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const raw = store.get<Settings>('rs-reader');
let settings: Settings = raw && typeof raw === 'object' ? raw : {};

function apply() {
  for (const k of KEYS) {
    const v = settings[k];
    if (v && v !== DEFAULTS[k] && /^[\w-]{1,12}$/.test(v)) root.setAttribute(`data-${k}`, v);
    else root.removeAttribute(`data-${k}`);
  }
  const focus = settings.focus === 'on';
  document.querySelectorAll<HTMLElement>('[data-focus-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(focus)));
  document.querySelectorAll<HTMLElement>('[data-focus-label]').forEach((l) => (l.textContent = focus ? 'Leave focus' : 'Focus'));
}

/* ── The settings form ────────────────────────────────────────────────────── */
const form = document.querySelector<HTMLFormElement>('[data-reader-form]');
function sync() {
  if (!form) return;
  for (const k of KEYS) {
    const v = settings[k] ?? DEFAULTS[k];
    const el = form.elements.namedItem(k);
    if (el instanceof RadioNodeList) Array.from(el).forEach((r) => ((r as HTMLInputElement).checked = (r as HTMLInputElement).value === v));
    else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v === 'on';
  }
}

function set(patch: Settings) {
  const at = place();
  settings = { ...settings, ...patch };
  for (const k of KEYS) if (!settings[k] || settings[k] === DEFAULTS[k]) delete settings[k];
  store.set('rs-reader', settings);
  apply();
  sync();
  // Keep your place while the text reflows (and again once a newly chosen face has loaded).
  if (at) {
    goTo(at);
    document.fonts?.ready.then(() => goTo(at));
  }
  update();
}

form?.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (!t.name || !(KEYS as string[]).includes(t.name)) return;
  set({ [t.name]: t.type === 'checkbox' ? (t.checked ? 'on' : 'off') : t.value });
});
form?.addEventListener('submit', (e) => e.preventDefault());
document.querySelector('[data-reader-reset]')?.addEventListener('click', () => {
  const keep = settings.focus;
  settings = {};
  set({ focus: keep });
});
document.querySelectorAll('[data-focus-toggle]').forEach((b) =>
  b.addEventListener('click', () => set({ focus: settings.focus === 'on' ? 'off' : 'on' })),
);
apply();
sync();

/* ── Where you are ────────────────────────────────────────────────────────── */
const reader = document.querySelector<HTMLElement>('[data-reader]');
const body = reader?.querySelector<HTMLElement>('.study .body') ?? null;
const sources = body?.querySelector<HTMLElement>('#sources') ?? null;
const minutes = Number(reader?.dataset.minutes ?? 0);
const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
const all = <T extends Element>(s: string) => [...document.querySelectorAll<T>(s)];
const meters = all<HTMLElement>('[data-meter]');
const lefts = all<HTMLElement>('[data-left]');
const pcts = all<HTMLElement>('[data-pct]');
const secs = all<HTMLElement>('[data-sec]');
const tocLinks = all<HTMLAnchorElement>('.toc a[href^="#"]');
const sheetLinks = all<HTMLAnchorElement>('#toc-sheet a[href^="#"]');
const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
const heads = [...byId.keys()].map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
// The blocks of the text, to remember a place to the paragraph.
const blocks = body ? [...body.querySelectorAll<HTMLElement>('p, li, h2, h3, figure, blockquote')].filter((b) => !sources?.contains(b)) : [];
const readingLine = () => Math.min(innerHeight * 0.3, 260);

/** How far through the text (not its sources) you are, 0 to 1. */
function fraction(): number {
  if (!body) return 0;
  const top = body.getBoundingClientRect().top;
  const end = sources ? sources.getBoundingClientRect().top : body.getBoundingClientRect().bottom;
  const f = (innerHeight * 0.4 - top) / Math.max(1, end - top);
  return Math.min(1, Math.max(0, f));
}

/** Your place: the first block crossing the top of the screen, and how far into it. */
function place(): { i: number; f: number } | null {
  if (!blocks.length) return null;
  const line = headerH() + 8;
  for (let i = 0; i < blocks.length; i++) {
    const r = blocks[i]!.getBoundingClientRect();
    if (r.bottom > line) return { i, f: r.height ? Math.max(0, Math.min(1, (line - r.top) / r.height)) : 0 };
  }
  return null;
}
function goTo(at: { i: number; f: number }) {
  const b = blocks[at.i];
  if (!b) return;
  const r = b.getBoundingClientRect();
  scrollBy({ top: r.top + r.height * at.f - (headerH() + 8), behavior: 'instant' as ScrollBehavior });
}
const headerH = () => document.querySelector('.site-header')?.getBoundingClientRect().height ?? 64;

let active: HTMLElement | undefined;
function update() {
  if (!body) return;
  const f = fraction();
  for (const m of meters) m.style.setProperty('--p', f.toFixed(4));
  const left = Math.ceil(minutes * (1 - f) - 0.05);
  const leftText = f >= 0.995 ? 'Read to the end' : `${Math.max(1, left)} min left`;
  for (const l of lefts) if (l.textContent !== leftText) l.textContent = leftText;
  for (const p of pcts) p.textContent = `${Math.round(f * 100)}%`;

  // The section you are in: the last heading above the reading line.
  const line = readingLine();
  let now: HTMLElement | undefined;
  for (const h of heads) if (h.getBoundingClientRect().top <= line) now = h;
  now ??= heads[0];
  if (now && now !== active) {
    active = now;
    const link = byId.get(now.id);
    const name = link?.querySelector('.tt')?.textContent?.trim() || link?.textContent?.trim() || '';
    const ref = link?.querySelector('.ref')?.textContent?.trim();
    for (const s of secs) s.textContent = s.closest('.readbar') && ref && !name.startsWith(ref) ? `${ref} · ${name}` : name;
    let past = true;
    for (const a of tocLinks) {
      const on = a === link;
      if (on) past = false;
      a.toggleAttribute('aria-current', on);
      a.classList.toggle('done', past && !on);
    }
    for (const a of sheetLinks) a.toggleAttribute('aria-current', a.hash === link?.hash);
    if (link) {
      const ol = link.closest('ol');
      ol?.style.setProperty('--toc-fill', `${link.offsetTop + link.offsetHeight}px`);
      const box = link.closest('.toc-scroll');
      if (box) {
        const lr = link.getBoundingClientRect(), br = box.getBoundingClientRect();
        if (lr.top < br.top + 40 || lr.bottom > br.bottom - 40) box.scrollTo({ top: box.scrollTop + (lr.top - br.top) - br.height / 3, behavior: reduced ? 'auto' : 'smooth' });
      }
    }
  }
}

/* ── Remembering your place ───────────────────────────────────────────────── */
interface Pos { i: number; f: number; p: number; sec: string; t: number }
interface Last { path: string; name: string; title: string; sec: string; p: number; t: number }
const positions = () => store.get<Record<string, Pos>>('rs-pos') ?? {};
let saveTimer = 0;
function save() {
  if (!body) return;
  const at = place();
  const p = fraction();
  if (!at) return;
  const map = positions();
  const sec = secs[0]?.textContent ?? '';
  if (p < 0.02 || p > 0.985) delete map[path];
  else map[path] = { i: at.i, f: Math.round(at.f * 1000) / 1000, p: Math.round(p * 1000) / 1000, sec, t: Date.now() };
  // Keep the twenty-five most recent.
  const keep = Object.entries(map).sort((a, b) => b[1].t - a[1].t).slice(0, 25);
  store.set('rs-pos', Object.fromEntries(keep));
  store.set('rs-last', { path, name: reader?.dataset.name ?? '', title: reader?.dataset.title ?? '', sec, p, t: Date.now() } satisfies Last);
}

// The reading bar steps aside while you read down and returns when you scroll up; in focus mode
// the header does the same.
const bar = document.querySelector<HTMLElement>('[data-readbar]');
const header = document.querySelector<HTMLElement>('.site-header');
let lastY = scrollY;
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    update();
    const y = scrollY;
    const nearEnd = y + innerHeight > document.documentElement.scrollHeight - 160;
    if (Math.abs(y - lastY) > 6) {
      const down = y > lastY && y > 240 && !nearEnd;
      bar?.classList.toggle('away', down && !document.querySelector(':popover-open'));
      header?.classList.toggle('tucked', down && settings.focus === 'on');
      lastY = y;
    }
    if (nearEnd) bar?.classList.remove('away');
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, 400);
  });
}

if (body) {
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { active = undefined; update(); }, { passive: true });
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save());
  update();
  document.fonts?.ready.then(() => { active = undefined; update(); });

  // The contents sheet closes once you choose a section.
  sheetLinks.forEach((a) => a.addEventListener('click', () => (document.getElementById('toc-sheet') as HTMLElement & { hidePopover?: () => void })?.hidePopover?.()));

  // Offer to pick up where you left off (not when arriving at a section by its link).
  const saved = positions()[path];
  const box = document.querySelector<HTMLElement>('[data-resume]');
  const fresh = saved && Date.now() - saved.t < 1000 * 60 * 60 * 24 * 180;
  if (box && saved && fresh && !location.hash && saved.p > 0.03 && saved.p < 0.97 && scrollY < 200) {
    const sec = box.querySelector('[data-resume-sec]');
    if (sec) sec.textContent = `${saved.sec || 'Your place'} · ${Math.round(saved.p * 100)}% read`;
    box.hidden = false;
    const close = () => {
      box.hidden = true;
      removeEventListener('scroll', far);
    };
    const startY = scrollY;
    const far = () => { if (Math.abs(scrollY - startY) > 600) close(); };
    addEventListener('scroll', far, { passive: true });
    box.querySelector('[data-resume-go]')?.addEventListener('click', () => {
      close();
      goTo({ i: saved.i, f: saved.f });
      document.fonts?.ready.then(() => goTo({ i: saved.i, f: saved.f }));
    });
    box.querySelector('[data-resume-x]')?.addEventListener('click', close);
    window.setTimeout(close, 15000);
  }
}

/* ── Keys ─────────────────────────────────────────────────────────────────── */
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
  if (document.querySelector(':popover-open')) return;
  if (e.key === 'Escape' && settings.focus === 'on' && !document.querySelector('.note-card.open')) {
    set({ focus: 'off' });
    return;
  }
  const rel = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : '';
  const link = rel ? document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) : null;
  if (link) {
    e.preventDefault();
    location.href = link.href;
  }
});

/* ── The home page: continue reading ──────────────────────────────────────── */
const cont = document.querySelector<HTMLAnchorElement>('[data-continue]');
if (cont) {
  const last = store.get<Last>('rs-last');
  const pos = last ? positions()[last.path] : undefined;
  if (last && pos && typeof last.path === 'string' && /^\/(revelation-\d{1,2}|timeline)$/.test(last.path)) {
    cont.href = last.path;
    const what = cont.querySelector('[data-continue-what]');
    const where = cont.querySelector('[data-continue-where]');
    if (what) what.textContent = last.name;
    if (where) where.textContent = `${pos.sec || last.title} · ${Math.round(pos.p * 100)}% read`;
    cont.hidden = false;
  }
}

export {};
