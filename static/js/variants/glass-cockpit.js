(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['glass-cockpit'] = (() => {
  // Pointer-tracking HUD: per-pane tilt (written as --tilt-x / --tilt-y on each
  // pane, clamped to -1..1; the stylesheet turns that into at most 4deg), a
  // lagging reticle, and four corner readouts. Throttled to ~30fps and idle
  // when nothing has moved.
  const PANES =
    '.hero, .entry, .service-row, .proof-row, .post-item, .content, .home-engage, ' +
    '.credibility-rail > div, .method-list > li, .wellbeing-focus, .technical-depth, .thread-copy';
  const FRAME = 1000 / 30;
  const root = document.documentElement;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let panes = [];
  let readouts = null;
  let reticle = null;
  let raf = 0;
  let last = 0;
  let dirty = true;
  let still = false;
  let lastSecond = -1;
  let seen = false;
  const pointer = { x: 0, y: 0 };
  const ret = { x: 0, y: 0 };

  const pad = (value, length) => String(Math.max(0, Math.round(value))).padStart(length, '0');
  const clamp = (value) => Math.max(-1, Math.min(1, value));
  const two = (value) => String(value).padStart(2, '0');

  function readout(corner) {
    const node = document.createElement('output');
    node.className = 'cockpit-readout';
    node.dataset.corner = corner;
    node.setAttribute('aria-hidden', 'true');
    document.body.append(node);
    return node;
  }

  function onMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!seen) {
      seen = true;
      ret.x = pointer.x;
      ret.y = pointer.y;
      reticle?.classList.add('is-live');
    }
    dirty = true;
  }

  function onLeave() {
    seen = false;
    reticle?.classList.remove('is-live');
  }

  function onChange() {
    dirty = true;
    if (readouts) readouts.br.textContent = `FOV ${window.innerWidth}×${window.innerHeight}`;
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') stop();
    else start();
  }

  function clock() {
    const now = new Date();
    const second = now.getSeconds();
    if (second === lastSecond || !readouts) return;
    lastSecond = second;
    readouts.tr.textContent = `T ${two(now.getHours())}:${two(now.getMinutes())}:${two(second)} L`;
  }

  function tilt() {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    const rects = panes.map((pane) => pane.getBoundingClientRect());
    for (let i = 0; i < panes.length; i += 1) {
      const rect = rects[i];
      const pane = panes[i];
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) {
        if (pane.style.getPropertyValue('--tilt-x')) {
          pane.style.removeProperty('--tilt-x');
          pane.style.removeProperty('--tilt-y');
        }
        continue;
      }
      const dx = clamp((pointer.x - (rect.left + rect.width / 2)) / hw);
      const dy = clamp((pointer.y - (rect.top + rect.height / 2)) / hh);
      pane.style.setProperty('--tilt-x', dx.toFixed(3));
      pane.style.setProperty('--tilt-y', dy.toFixed(3));
    }
    root.style.setProperty('--tilt-x', clamp((pointer.x - hw) / hw).toFixed(3));
    root.style.setProperty('--tilt-y', clamp((pointer.y - hh) / hh).toFixed(3));
  }

  function tick(now) {
    raf = window.requestAnimationFrame(tick);
    if (now - last < FRAME) return;
    last = now;
    clock();
    if (!dirty) return;
    dirty = false;
    if (readouts) {
      readouts.tl.textContent = `PTR ${pad(pointer.x, 4)} ${pad(pointer.y, 4)}`;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const depth = max > 0 ? (window.scrollY / max) * 100 : 0;
      readouts.bl.textContent = `DEPTH ${pad(depth, 3)}%`;
    }
    if (still || !fine.matches || !seen) return;
    tilt();
    if (reticle) {
      ret.x += (pointer.x - ret.x) * 0.22;
      ret.y += (pointer.y - ret.y) * 0.22;
      reticle.style.transform = `translate3d(${ret.x.toFixed(1)}px, ${ret.y.toFixed(1)}px, 0)`;
      if (Math.abs(pointer.x - ret.x) > 0.4 || Math.abs(pointer.y - ret.y) > 0.4) dirty = true;
    }
  }

  function start() {
    if (raf) return;
    last = performance.now();
    dirty = true;
    raf = window.requestAnimationFrame(tick);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  return {
    mount({ reduceMotion }) {
      still = Boolean(reduceMotion);
      panes = [...document.querySelectorAll(PANES)];
      pointer.x = window.innerWidth / 2;
      pointer.y = window.innerHeight / 2;
      readouts = { tl: readout('tl'), tr: readout('tr'), bl: readout('bl'), br: readout('br') };
      readouts.tl.textContent = 'PTR ---- ----';
      onChange();
      lastSecond = -1;
      clock();
      if (!still && fine.matches) {
        reticle = document.createElement('div');
        reticle.className = 'cockpit-reticle';
        reticle.setAttribute('aria-hidden', 'true');
        document.body.append(reticle);
        document.addEventListener('pointermove', onMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);
      }
      window.addEventListener('scroll', onChange, { passive: true });
      window.addEventListener('resize', onChange);
      document.addEventListener('visibilitychange', onVisibility);
      if (document.visibilityState !== 'hidden') start();
    },
    unmount() {
      stop();
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const pane of panes) {
        pane.style.removeProperty('--tilt-x');
        pane.style.removeProperty('--tilt-y');
      }
      panes = [];
      root.style.removeProperty('--tilt-x');
      root.style.removeProperty('--tilt-y');
      if (readouts) for (const node of Object.values(readouts)) node.remove();
      readouts = null;
      reticle?.remove();
      reticle = null;
      seen = false;
      dirty = true;
    },
  };
})();
