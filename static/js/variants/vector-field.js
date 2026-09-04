(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['vector-field'] = (() => {
  let readout = null;
  let frame = 0;
  const root = document.documentElement;
  const onMove = (event) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;
      root.style.setProperty('--field-x', (x - 0.5).toFixed(3));
      root.style.setProperty('--field-y', (y - 0.5).toFixed(3));
      if (readout) {
        readout.textContent = `X ${String(Math.round(x * 100)).padStart(3, '0')} / Y ${String(Math.round(y * 100)).padStart(3, '0')}`;
      }
      frame = 0;
    });
  };
  return {
    mount({ reduceMotion }) {
      readout = document.createElement('output');
      readout.className = 'vector-readout';
      readout.setAttribute('aria-hidden', 'true');
      readout.textContent = 'X 050 / Y 050';
      document.body.append(readout);
      if (!reduceMotion) document.addEventListener('pointermove', onMove, { passive: true });
    },
    unmount() {
      document.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      root.style.removeProperty('--field-x');
      root.style.removeProperty('--field-y');
      readout?.remove();
      readout = null;
    },
  };
})();
