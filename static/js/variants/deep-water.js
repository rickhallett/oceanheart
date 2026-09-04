(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['deep-water'] = (() => {
  // Caustic light, sampled at low resolution and left to the browser (and a
  // CSS blur) to smooth. Two sines per pixel; everything else is hoisted.
  const CELL = 6;
  const FRAME = 1000 / 30;
  const SCALE = 9;
  const TAU = Math.PI * 2;
  let canvas = null;
  let ctx = null;
  let image = null;
  let width = 0;
  let height = 0;
  let cols = null;
  let rows = null;
  let colA = null;
  let colPool = null;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let still = false;
  let resizeTimer = 0;
  const snow = [];

  function flake(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.04,
      r: 0.45 + Math.random() * 1.1,
      v: 0.008 + Math.random() * 0.016,
      phase: Math.random() * TAU,
      a: 0.12 + Math.random() * 0.3,
    };
  }

  function size() {
    if (!canvas) return;
    width = Math.max(4, Math.ceil(window.innerWidth / CELL));
    height = Math.max(4, Math.ceil(window.innerHeight / CELL));
    canvas.width = width;
    canvas.height = height;
    image = ctx.createImageData(width, height);
    const aspect = width / height;
    cols = new Float32Array(width);
    rows = new Float32Array(height);
    colA = new Float32Array(width);
    colPool = new Float32Array(width);
    for (let x = 0; x < width; x += 1) cols[x] = (x / width) * SCALE * aspect;
    for (let y = 0; y < height; y += 1) rows[y] = (y / height) * SCALE;
    if (!snow.length) {
      for (let i = 0; i < 44; i += 1) snow.push(flake(true));
    }
  }

  function paint() {
    if (!ctx || !image) return;
    const data = image.data;
    const t = clock;
    for (let x = 0; x < width; x += 1) {
      colA[x] = Math.sin(cols[x] * 1.7 + t * 0.35);
      colPool[x] = Math.sin(cols[x] * 0.45 - t * 0.11);
    }
    let p = 0;
    for (let y = 0; y < height; y += 1) {
      const py = rows[y];
      const depth = 1 - (y / height) * 0.55;
      const rowA = Math.sin(py * 1.3 - t * 0.22);
      const rowPool = Math.sin(py * 0.4 + t * 0.09);
      const kb = py * 0.9 + t * 0.27;
      const kc = -py * 1.1 - t * 0.31;
      for (let x = 0; x < width; x += 1) {
        const px = cols[x];
        const sum = colA[x] + rowA + Math.sin(px * 0.9 + kb) + Math.sin(px * 0.6 + kc);
        let k = 1 - Math.abs(sum * 0.25);
        k *= k;
        k *= k * k;
        const pool = 0.6 + 0.4 * colPool[x] * rowPool;
        const l = k * pool * depth;
        data[p] = 127 + l * 110;
        data[p + 1] = 214 + l * 41;
        data[p + 2] = 200 + l * 55;
        data[p + 3] = l * 165;
        p += 4;
      }
    }
    ctx.putImageData(image, 0, 0);
    for (const f of snow) {
      ctx.beginPath();
      ctx.arc(f.x * width, f.y * height, f.r, 0, TAU);
      ctx.fillStyle = `rgba(210, 245, 238, ${f.a.toFixed(3)})`;
      ctx.fill();
    }
  }

  function advance(dt) {
    for (let i = 0; i < snow.length; i += 1) {
      const f = snow[i];
      f.y -= f.v * dt;
      f.x += Math.sin(clock * 0.25 + f.phase) * 0.012 * dt;
      if (f.y < -0.05) snow[i] = flake(false);
    }
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    if (now - last < FRAME) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    advance(dt);
    paint();
  }

  function start() {
    if (raf || still || !canvas) return;
    last = performance.now();
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') stop();
    else start();
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      size();
      paint();
    }, 120);
  }

  return {
    mount({ reduceMotion }) {
      still = Boolean(reduceMotion);
      canvas = document.createElement('canvas');
      canvas.className = 'deep-water-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        canvas = null;
        return;
      }
      document.body.prepend(canvas);
      clock = Math.random() * 200;
      size();
      paint();
      window.addEventListener('resize', onResize);
      if (!still) {
        document.addEventListener('visibilitychange', onVisibility);
        if (document.visibilityState !== 'hidden') start();
      }
    },
    unmount() {
      stop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (canvas) canvas.remove();
      canvas = null;
      ctx = null;
      image = null;
      cols = rows = colA = colPool = null;
      snow.length = 0;
    },
  };
})();
