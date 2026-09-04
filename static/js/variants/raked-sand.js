(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['raked-sand'] = (() => {
  // Generative rake. Every content block is a stone: concentric rings hug it,
  // and long lines seeded across the garden bend around it (a flow field with
  // an occupancy grid so lines stay evenly spaced and end when squeezed).
  // Static once drawn. The canvas is two viewports tall; during a scroll it is
  // translated with the page, and re-raked once the scroll settles.
  const STONES =
    '.hero, .entry, .service-row, .proof-row, .content, .home-engage, .method-section, ' +
    '.wellbeing-focus, .technical-depth, .thread, .post-list, ' +
    '.section-intro, .section-header, .page-head, article > header';
  const SPACING = 11;
  const STEP = 3;
  const PAD = 8;
  const RINGS = 4;
  const BAND = 90;
  const CELL = 3;
  const SHADOW = 'rgba(43, 38, 32, 0.13)';
  const LIGHT = 'rgba(255, 251, 240, 0.62)';
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let scrollTimer = 0;
  let resizeTimer = 0;
  let drawnScroll = 0;
  let mounted = false;
  let stones = [];

  function measure() {
    const scrollY = window.scrollY;
    const raw = [...document.querySelectorAll(STONES)]
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 40 && r.height > 24)
      .map((r) => ({ l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY }));
    stones = raw.filter(
      (a) => !raw.some((b) => b !== a && b.l <= a.l && b.t <= a.t && b.r >= a.r && b.b >= a.b),
    );
  }

  function distance(stone, x, y, out) {
    const cx = Math.min(Math.max(x, stone.l - PAD), stone.r + PAD);
    const cy = Math.min(Math.max(y, stone.t - PAD), stone.b + PAD);
    let dx = x - cx;
    let dy = y - cy;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) {
      d = 0;
      dx = 0;
      dy = y < (stone.t + stone.b) / 2 ? -1 : 1;
    } else {
      dx /= d;
      dy /= d;
    }
    out.d = d;
    out.nx = dx;
    out.ny = dy;
    return out;
  }

  const probe = { d: 0, nx: 0, ny: 0 };

  function field(x, y, near, sign, out) {
    // Direction of travel: the rake runs left to right (sign flips it for the
    // backward half of a gap-seeded line), with a slow hand-drawn wobble.
    const ux = sign;
    const uy = sign * (0.08 * Math.sin(x * 0.007 + y * 0.003) + 0.05 * Math.sin(x * 0.021 - y * 0.013));
    const ringOuter = PAD + (RINGS - 1) * SPACING + SPACING * 0.6;
    let base = 1;
    let px = 0;
    let py = 0;
    for (let i = 0; i < near.length; i += 1) {
      const stone = near[i];
      distance(stone, x, y, probe);
      if (probe.d < ringOuter) return false;
      if (probe.d > ringOuter + BAND) continue;
      let w = 1 - (probe.d - ringOuter) / BAND;
      w = w * w * (3 - 2 * w);
      // A line heading straight at a face simply ends at the rings, as a rake
      // would; only glancing lines bulge around the stone.
      const facing = -(probe.nx * ux + probe.ny * uy);
      let glance = Math.min(1, Math.max(0, (facing - 0.25) / 0.45));
      glance = 1 - glance * glance * (3 - 2 * glance);
      w *= glance;
      if (w <= 0) continue;
      let tx = -probe.ny;
      let ty = probe.nx;
      let dot = tx * ux + ty * uy;
      if (Math.abs(dot) < 0.05) {
        const above = y < (stone.t + stone.b) / 2;
        dot = (above ? ty < 0 : ty > 0) ? 1 : -1;
      }
      if (dot < 0) {
        tx = -tx;
        ty = -ty;
      }
      px += w * (tx * 0.55 + probe.nx * 0.3);
      py += w * (ty * 0.55 + probe.ny * 0.3);
      base = Math.min(base, 1 - w * 0.6);
    }
    const vx = ux * base + px;
    const vy = uy * base + py;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    out.x = vx / len;
    out.y = vy / len;
    return true;
  }

  function rake(width, height, top) {
    const cols = Math.ceil(width / CELL) + 1;
    const rows = Math.ceil(height / CELL) + 1;
    const grid = new Int32Array(cols * rows);
    const bottom = top + height;
    const near = stones.filter((s) => s.b + BAND + 40 > top && s.t - BAND - 40 < bottom && s.l < width + BAND);
    const v = { x: 0, y: 0 };
    const paths = [];
    let id = 0;

    const cellOf = (x, y) => Math.floor((y - top) / CELL) * cols + Math.floor(x / CELL);

    const busy = (x, y, self, radius) => {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor((y - top) / CELL);
      for (let j = -radius; j <= radius; j += 1) {
        const yy = cy + j;
        if (yy < 0 || yy >= rows) continue;
        for (let i = -radius; i <= radius; i += 1) {
          const xx = cx + i;
          if (xx < 0 || xx >= cols) continue;
          const owner = grid[yy * cols + xx];
          if (owner && owner !== self) return true;
        }
      }
      return false;
    };

    const trace = (x0, y0, sign, self) => {
      const points = [];
      let x = x0;
      let y = y0;
      const limit = Math.ceil(width / STEP) + 60;
      for (let n = 0; n < limit; n += 1) {
        if (x < -STEP || x > width + STEP || y < top - STEP || y > bottom + STEP) break;
        if (!field(x, y, near, sign, v)) break;
        if (busy(x, y, self, 1)) break;
        points.push(x, y);
        x += v.x * STEP;
        y += v.y * STEP;
      }
      return points;
    };

    const mark = (points, self) => {
      for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        if (x < 0 || x >= width || y < top || y >= bottom) continue;
        grid[cellOf(x, y)] = self;
      }
    };

    const seed = (x, y, both) => {
      if (busy(x, y, 0, 2)) return;
      id += 1;
      const forward = trace(x, y, 1, id);
      let points = forward;
      if (both) {
        const back = trace(x, y, -1, id);
        const reversed = [];
        for (let i = back.length - 2; i >= 2; i -= 2) reversed.push(back[i], back[i + 1]);
        points = reversed.concat(forward);
      }
      if (points.length < 30) return;
      mark(points, id);
      paths.push(points);
    };

    const firstRow = Math.floor(top / SPACING) * SPACING;
    for (let y = firstRow; y <= bottom; y += SPACING) seed(0.5, y, false);
    for (let x = 24; x < width; x += 36) {
      for (let y = firstRow + SPACING / 2; y <= bottom; y += SPACING) seed(x, y, true);
    }
    return { paths, near };
  }

  function ringSamples(stone, offset, step) {
    const rad = 6 + offset;
    const l = stone.l - offset;
    const t = stone.t - offset;
    const r = stone.r + offset;
    const b = stone.b + offset;
    const pts = [];
    const line = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i <= n; i += 1) pts.push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
    };
    const arc = (cx, cy, a0, a1) => {
      const n = Math.max(2, Math.ceil((rad * (a1 - a0)) / step));
      for (let i = 0; i <= n; i += 1) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
    };
    line(l + rad, t, r - rad, t);
    arc(r - rad, t + rad, -Math.PI / 2, 0);
    line(r, t + rad, r, b - rad);
    arc(r - rad, b - rad, 0, Math.PI / 2);
    line(r - rad, b, l + rad, b);
    arc(l + rad, b - rad, Math.PI / 2, Math.PI);
    line(l, b - rad, l, t + rad);
    arc(l + rad, t + rad, Math.PI, Math.PI * 1.5);
    return pts;
  }

  function ring(stone, offset, others) {
    const pts = ringSamples(stone, offset, 4);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      let hidden = false;
      for (let j = 0; j < others.length; j += 1) {
        const o = others[j];
        if (o === stone) continue;
        if (x > o.l - offset && x < o.r + offset && y > o.t - offset && y < o.b + offset) {
          hidden = true;
          break;
        }
      }
      if (hidden) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke();
  }

  function strokeAll(paths, near) {
    const passes = [
      { colour: LIGHT, dy: -1 },
      { colour: SHADOW, dy: 0 },
    ];
    for (const pass of passes) {
      ctx.save();
      ctx.translate(0, pass.dy);
      ctx.strokeStyle = pass.colour;
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const stone of near) {
        for (let i = 0; i < RINGS; i += 1) ring(stone, PAD + i * SPACING, near);
      }
      for (const points of paths) {
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function draw() {
    raf = 0;
    if (!mounted || !canvas || !ctx) return;
    const width = window.innerWidth;
    const viewport = window.innerHeight;
    const height = viewport * 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    measure();
    drawnScroll = window.scrollY;
    const top = drawnScroll - viewport / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(0, -top);
    const { paths, near } = rake(width, height, top);
    strokeAll(paths, near);
    canvas.style.transform = '';
    canvas.classList.add('is-raked');
  }

  function schedule() {
    if (raf) return;
    raf = window.requestAnimationFrame(draw);
  }

  function onScroll() {
    if (!canvas) return;
    const shift = drawnScroll - window.scrollY;
    canvas.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      if (window.scrollY !== drawnScroll) schedule();
    }, 180);
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(schedule, 160);
  }

  return {
    mount() {
      mounted = true;
      canvas = document.createElement('canvas');
      canvas.className = 'raked-sand-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d');
      if (!ctx) {
        canvas = null;
        return;
      }
      document.body.prepend(canvas);
      schedule();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          if (mounted) schedule();
        });
      }
      window.setTimeout(() => {
        if (mounted) schedule();
      }, 1200);
    },
    unmount() {
      mounted = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(scrollTimer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (canvas) canvas.remove();
      canvas = null;
      ctx = null;
      stones = [];
      drawnScroll = 0;
    },
  };
})();
