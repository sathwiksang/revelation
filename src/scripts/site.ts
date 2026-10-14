/**
 * The little behaviour the site has. Everything works without it; this adds:
 * – gentle reveals as sections come into view,
 * – footnote cards: hover or tap a note number to see the source it names.
 * (The reading settings, your place and the contents are in reader.ts.)
 */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Reveals ──────────────────────────────────────────────────────────────── */
const revealables = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (reduced || !('IntersectionObserver' in window)) {
  revealables.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  revealables.forEach((el) => io.observe(el));
}

/* ── Footnote cards ───────────────────────────────────────────────────────── */
const article = document.querySelector<HTMLElement>('.study');
if (article) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.setAttribute('role', 'tooltip');
  card.id = 'note-card';
  card.hidden = true;
  document.body.append(card);

  let current: HTMLAnchorElement | null = null;
  let hideTimer = 0;

  const defsFor = (n: string) => [...article.querySelectorAll<HTMLElement>(`.def[data-nums~="${n}"]`)];

  const fill = (a: HTMLAnchorElement) => {
    const n = a.dataset.n ?? '';
    const defs = defsFor(n);
    card.replaceChildren();
    const head = document.createElement('p');
    head.className = 'note-head';
    head.textContent = `Note ${n}`;
    card.append(head);
    if (!defs.length) {
      // Some chapters list their sources together, without numbers: show that list.
      const listed = article.querySelector('.def') ? [] : [...article.querySelectorAll<HTMLElement>('#sources li')].slice(0, 6);
      const p = document.createElement('p');
      p.className = 'note-body';
      p.textContent = listed.length ? 'This chapter lists its sources together:' : 'This number has no entry of its own in the sources at the end of this chapter.';
      card.append(p);
      if (listed.length) {
        const ul = document.createElement('ul');
        ul.className = 'note-list';
        for (const li of listed) {
          const item = document.createElement('li');
          item.append(...[...li.cloneNode(true).childNodes]);
          ul.append(item);
        }
        card.append(ul);
      }
    }
    for (const d of defs.slice(0, 3)) {
      const clone = d.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.def-num').forEach((x) => x.remove());
      clone.removeAttribute('id');
      const body = document.createElement('div');
      body.className = 'note-body';
      body.append(...clone.childNodes);
      card.append(body);
    }
    const go = document.createElement('a');
    go.href = a.getAttribute('href') ?? '#sources';
    go.className = 'note-go';
    go.textContent = 'Go to the sources →';
    card.append(go);
  };

  const place = (a: HTMLAnchorElement) => {
    const r = a.getBoundingClientRect();
    card.hidden = false;
    const w = card.offsetWidth, h = card.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, vw - w - 12));
    let top = r.bottom + 10;
    if (top + h > innerHeight - 12 && r.top - h - 10 > 12) top = r.top - h - 10;
    card.style.left = `${left + scrollX}px`;
    card.style.top = `${top + scrollY}px`;
  };

  const show = (a: HTMLAnchorElement) => {
    clearTimeout(hideTimer);
    if (current !== a) {
      current?.removeAttribute('aria-describedby');
      current = a;
      fill(a);
    }
    a.setAttribute('aria-describedby', 'note-card');
    place(a);
    requestAnimationFrame(() => card.classList.add('open'));
  };
  const hide = (now = false) => {
    clearTimeout(hideTimer);
    const go = () => {
      card.classList.remove('open');
      card.hidden = true;
      current?.removeAttribute('aria-describedby');
      current = null;
    };
    if (now) go();
    else hideTimer = window.setTimeout(go, 180);
  };

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  article.addEventListener('pointerover', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('sup.fn a');
    if (a && fine.matches) show(a);
  });
  article.addEventListener('pointerout', (e) => {
    if ((e.target as Element).closest('sup.fn a') && fine.matches) hide();
  });
  card.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  card.addEventListener('pointerleave', () => hide());
  article.addEventListener('focusin', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('sup.fn a');
    if (a) show(a);
  });
  article.addEventListener('focusout', (e) => {
    if ((e.target as Element).closest('sup.fn a') && !card.contains(e.relatedTarget as Node)) hide();
  });
  // On touch screens, the first tap shows the note; a second tap follows the link.
  article.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('sup.fn a');
    if (!a || fine.matches) return;
    if (current !== a || card.hidden) {
      e.preventDefault();
      show(a);
    }
  });
  document.addEventListener('click', (e) => {
    if (!card.hidden && !card.contains(e.target as Node) && !(e.target as Element).closest('sup.fn a')) hide(true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) {
      const a = current;
      hide(true);
      a?.focus();
    }
  });
  addEventListener('scroll', () => { if (!card.hidden && !fine.matches) hide(true); }, { passive: true });
}

/* ── Close the chapters menu after choosing (same-page anchors) ───────────── */
document.querySelectorAll<HTMLAnchorElement>('#chapters-menu a').forEach((a) =>
  a.addEventListener('click', () => (document.getElementById('chapters-menu') as HTMLElement & { hidePopover?: () => void })?.hidePopover?.()),
);

export {};
