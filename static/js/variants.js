/*
  Oceanheart skins: the switching engine.

  One page, many visual systems. A skin is a stylesheet keyed off
  body[data-variant] plus an optional effects module. This file loads skins on
  demand, swaps them in place (no navigation), remembers the choice, mirrors it
  into ?theme= so a link carries the skin, and drives the dock UI.

  Public surface, for anyone poking at the console:
    oceanheartSkins.list()          -> the registry
    oceanheartSkins.apply('redline') -> switch and remember
    oceanheartSkins.apply('')        -> back to the house style
*/
(() => {
  const STORAGE_KEY = 'oceanheart-skin';
  const HINT_KEY = 'oceanheart-skin-hinted';
  const assetVersion = document.currentScript?.dataset.assetVersion || '';
  const versioned = (path) =>
    assetVersion ? `${path}?v=${encodeURIComponent(assetVersion)}` : path;
  const registryNode = document.getElementById('variant-registry');
  const dock = document.querySelector('[data-variant-dock]');
  if (!registryNode || !dock) return;

  let registry = [];
  try {
    registry = JSON.parse(registryNode.textContent || '[]');
  } catch {
    return;
  }
  const bySlug = new Map(registry.map((skin) => [skin.slug, skin]));
  const house = document.getElementById('house-style');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  const effects = (window.oceanheartSkinEffects = window.oceanheartSkinEffects || {});
  const loadedThemes = new Map();
  const loadedEffects = new Map();
  let committed = document.body.getAttribute('data-variant') || '';
  let displayed = committed;
  let mountedEffect = '';

  function storage(action, value) {
    try {
      if (action === 'get') return window.localStorage.getItem(STORAGE_KEY);
      if (action === 'set') window.localStorage.setItem(STORAGE_KEY, value);
      if (action === 'remove') window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing may refuse storage; the switch still works for the page.
    }
    return null;
  }

  function loadStylesheet(slug) {
    if (!slug) return Promise.resolve();
    if (loadedThemes.has(slug)) return loadedThemes.get(slug);
    const existing = document.querySelector(`link[data-variant-theme="${slug}"]`);
    if (existing) {
      const ready = existing.sheet
        ? Promise.resolve()
        : new Promise((resolve) => {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', resolve, { once: true });
          });
      loadedThemes.set(slug, ready);
      return ready;
    }
    const promise = new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = versioned(`/css/variants/themes/${slug}.css`);
      link.dataset.variantTheme = slug;
      // Fetch now, apply later: a disabled link is never fetched, but
      // media="not all" downloads and stays inert until paint() flips it.
      link.media = 'not all';
      link.addEventListener('load', () => resolve(link), { once: true });
      link.addEventListener('error', () => resolve(link), { once: true });
      document.head.append(link);
    });
    loadedThemes.set(slug, promise);
    return promise;
  }

  function loadEffects(slug) {
    const skin = bySlug.get(slug);
    if (!skin || !skin.effects) return Promise.resolve();
    if (effects[slug]) return Promise.resolve();
    if (loadedEffects.has(slug)) return loadedEffects.get(slug);
    const promise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = versioned(`/js/variants/${slug}.js`);
      script.async = true;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', resolve, { once: true });
      document.head.append(script);
    });
    loadedEffects.set(slug, promise);
    return promise;
  }

  function unmountEffect() {
    if (!mountedEffect) return;
    const module = effects[mountedEffect];
    try {
      if (module && typeof module.unmount === 'function') module.unmount();
    } catch {
      // A misbehaving effect must never block a switch.
    }
    mountedEffect = '';
  }

  function mountEffect(slug) {
    const module = effects[slug];
    if (!module || typeof module.mount !== 'function') return;
    try {
      module.mount({ reduceMotion: reduceMotion.matches });
      mountedEffect = slug;
    } catch {
      mountedEffect = '';
    }
  }

  function paint(slug) {
    for (const link of document.querySelectorAll('link[data-variant-theme]')) {
      const active = link.dataset.variantTheme === slug;
      link.media = active ? 'all' : 'not all';
      link.disabled = false;
    }
    if (house) house.disabled = Boolean(slug);
    if (slug) {
      document.documentElement.setAttribute('data-variant', slug);
      document.body.setAttribute('data-variant', slug);
    } else {
      document.documentElement.removeAttribute('data-variant');
      document.body.removeAttribute('data-variant');
    }
    displayed = slug;
  }

  async function show(slug, { transition = true } = {}) {
    if (slug && !bySlug.has(slug)) slug = '';
    await Promise.all([loadStylesheet(slug), loadEffects(slug)]);
    if (displayed === slug) return;
    const swap = () => {
      unmountEffect();
      paint(slug);
      mountEffect(slug);
    };
    if (transition && !reduceMotion.matches && typeof document.startViewTransition === 'function') {
      await document.startViewTransition(swap).finished.catch(() => {});
    } else {
      swap();
    }
    renderDock();
  }

  async function apply(slug, options = {}) {
    if (slug && !bySlug.has(slug)) return;
    committed = slug;
    if (slug) storage('set', slug);
    else storage('remove');
    await show(slug, options);
    syncUrl(slug);
    announce(slug ? `${bySlug.get(slug).name} on every page` : 'House style restored');
  }

  function syncUrl(slug) {
    try {
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set('theme', slug);
      else url.searchParams.delete('theme');
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // Nothing to do; the choice is still stored.
    }
  }

  function neighbour(step) {
    const slugs = ['', ...registry.map((skin) => skin.slug)];
    const index = slugs.indexOf(committed);
    return slugs[(index + step + slugs.length) % slugs.length];
  }

  function shuffle() {
    const candidates = registry.map((skin) => skin.slug).filter((slug) => slug !== committed);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ---- dock ---------------------------------------------------------------

  const toggle = dock.querySelector('[data-dock-toggle]');
  const panel = dock.querySelector('[data-dock-panel]');
  const indexNode = dock.querySelector('[data-dock-index]');
  const nameNode = dock.querySelector('[data-dock-name]');
  const liveNode = dock.querySelector('[data-dock-live]');
  const cards = [...dock.querySelectorAll('[data-skin]')];
  const total = String(registry.length).padStart(2, '0');
  let hoverTimer = 0;

  function renderDock() {
    const skin = bySlug.get(displayed);
    if (indexNode) indexNode.textContent = `${skin ? skin.number : '00'}/${total}`;
    if (nameNode) nameNode.textContent = skin ? skin.name : 'House style';
    for (const card of cards) {
      card.setAttribute('aria-pressed', String((card.dataset.skin || '') === committed));
    }
  }

  function announce(text) {
    if (liveNode) liveNode.textContent = text;
  }

  function setOpen(open) {
    dock.dataset.open = String(open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (panel) panel.hidden = !open;
    dock.classList.remove('is-nudging');
    if (open) {
      try {
        window.localStorage.setItem(HINT_KEY, '1');
      } catch {
        // ignore
      }
      const current = cards.find((card) => (card.dataset.skin || '') === committed);
      (current || cards[0])?.focus({ preventScroll: true });
    } else if (displayed !== committed) {
      show(committed, { transition: false });
    }
  }

  toggle?.addEventListener('click', () => setOpen(dock.dataset.open !== 'true'));

  for (const card of cards) {
    const slug = card.dataset.skin || '';
    card.addEventListener('click', () => {
      apply(slug);
    });
    card.addEventListener('pointerenter', () => {
      if (!canHover.matches) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => show(slug, { transition: false }), 140);
    });
    card.addEventListener('focus', () => {
      show(slug, { transition: false });
    });
  }

  panel?.addEventListener('pointerleave', () => {
    window.clearTimeout(hoverTimer);
    if (displayed !== committed) show(committed, { transition: false });
  });

  dock.querySelector('[data-skin-shuffle]')?.addEventListener('click', () => {
    apply(shuffle());
  });

  for (const button of document.querySelectorAll('[data-open-skin-dock]')) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(true);
    });
  }

  for (const button of document.querySelectorAll('[data-random-skin]')) {
    button.addEventListener('click', () => apply(shuffle()));
  }

  dock.querySelector('[data-skin-share]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const url = new URL(window.location.href);
    if (committed) url.searchParams.set('theme', committed);
    else url.searchParams.delete('theme');
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(url.toString());
      button.textContent = 'Link copied';
    } catch {
      button.textContent = url.toString();
    }
    window.setTimeout(() => {
      button.textContent = label;
    }, 2200);
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape' && dock.dataset.open === 'true') {
      setOpen(false);
      toggle?.focus();
      return;
    }
    if (event.key === ']') apply(neighbour(1));
    if (event.key === '[') apply(neighbour(-1));
  });

  document.addEventListener('click', (event) => {
    if (dock.dataset.open === 'true' && event.target instanceof Node && !dock.contains(event.target)) {
      setOpen(false);
    }
  });

  // ---- boot ---------------------------------------------------------------

  if (committed) {
    loadStylesheet(committed);
    loadEffects(committed).then(() => mountEffect(committed));
  }
  renderDock();

  let hinted = true;
  try {
    hinted = Boolean(window.localStorage.getItem(HINT_KEY)) || Boolean(storage('get'));
  } catch {
    hinted = true;
  }
  if (!hinted && !reduceMotion.matches) {
    window.setTimeout(() => dock.classList.add('is-nudging'), 5000);
  }

  // Warm the two neighbours so [ and ] feel instant.
  window.setTimeout(() => {
    loadStylesheet(neighbour(1));
    loadStylesheet(neighbour(-1));
  }, 1500);

  window.oceanheartSkins = {
    list: () => registry.slice(),
    current: () => committed,
    apply: (slug) => apply(slug || ''),
  };

  try {
    console.info(
      '%cThis site has ' + registry.length + ' skins.%c Try oceanheartSkins.apply("' +
        shuffle() +
        '") or press ] to cycle.',
      'font-weight:700',
      'font-weight:400',
    );
  } catch {
    // ignore
  }
})();
