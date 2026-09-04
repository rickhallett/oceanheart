/*
  Heavy type effects. Scroll velocity, smoothed over frames, becomes weight and
  width: --wght runs from 300 at rest to 900 at speed, --wdth from 100 to 128,
  both written on the root so the skin's headings pick them up through
  font-variation-settings. On mount the page lands at 900 and relaxes to rest.
  Reduced motion: a fixed 600, no loop, no listener.
*/
(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['heavy-type'] = (() => {
  const root = document.documentElement;
  const REST = 300;
  const PEAK = 900;
  const WIDTH_REST = 100;
  const WIDTH_PEAK = 128;
  const TOP_SPEED = 2.4; // px per ms: anything faster counts as full mass
  const GAIN = 0.32; // how quickly type takes on weight
  const RELAX = 0.07; // how slowly it lets go

  let frame = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let touched = false;
  let weight = REST;
  let width = WIDTH_REST;
  let onScroll = null;

  function write() {
    root.style.setProperty('--wght', weight.toFixed(0));
    root.style.setProperty('--wdth', width.toFixed(1));
  }

  function tick() {
    frame = 0;
    if (!touched) velocity *= 0.88;
    touched = false;

    const drive = Math.sqrt(Math.min(1, velocity / TOP_SPEED));
    const targetWeight = REST + (PEAK - REST) * drive;
    const targetWidth = WIDTH_REST + (WIDTH_PEAK - WIDTH_REST) * drive;
    weight += (targetWeight - weight) * (targetWeight > weight ? GAIN : RELAX);
    width += (targetWidth - width) * (targetWidth > width ? GAIN : RELAX);
    write();

    const settled = Math.abs(weight - targetWeight) < 0.4 && velocity < 0.005;
    if (settled) {
      weight = targetWeight;
      width = targetWidth;
      write();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  }

  function wake() {
    if (!frame) frame = window.requestAnimationFrame(tick);
  }

  return {
    mount({ reduceMotion } = {}) {
      if (reduceMotion) {
        root.style.setProperty('--wght', '600');
        root.style.setProperty('--wdth', '100');
        return;
      }
      lastY = window.scrollY;
      lastTime = performance.now();
      velocity = 0;
      weight = PEAK;
      width = WIDTH_PEAK;
      write();

      onScroll = () => {
        const now = performance.now();
        const y = window.scrollY;
        const elapsed = Math.max(1, now - lastTime);
        const instant = Math.min(Math.abs(y - lastY) / elapsed, TOP_SPEED * 1.5);
        velocity = velocity * 0.55 + instant * 0.45;
        touched = true;
        lastY = y;
        lastTime = now;
        wake();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      wake();
    },

    unmount() {
      if (onScroll) window.removeEventListener('scroll', onScroll);
      onScroll = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      velocity = 0;
      touched = false;
      weight = REST;
      width = WIDTH_REST;
      root.style.removeProperty('--wght');
      root.style.removeProperty('--wdth');
    },
  };
})();
