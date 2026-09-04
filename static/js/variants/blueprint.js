/*
  Blueprint effects. Every major block on the page is a drawn part; this module
  hangs an inline SVG of dimension lines off each one and lets the lines draw
  themselves (stroke-dashoffset) as the part scrolls into view. Widths and
  heights are read from layout and written back as the dimension labels.
  mount/unmount are called repeatedly as visitors hover between skins, so
  unmount removes every node, observer and listener this file creates.
*/
(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['blueprint'] = (() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const PAD = 24; // must match .bp-dim top/left in blueprint.css
  const TARGETS = [
    ['.hero', 'block'],
    ['.content', 'block'],
    ['.method-section', 'block'],
    ['.home-engage', 'block'],
    ['.wellbeing-focus', 'block'],
    ['.technical-depth', 'block'],
    ['.entry', 'row'],
    ['.service-row', 'row'],
    ['.proof-row', 'row'],
  ];

  const items = [];
  const byBlock = new Map();
  const pending = new Set();
  let intersection = null;
  let resize = null;
  let frame = 0;
  let onWindowResize = null;
  let motionless = false;

  const make = (name, attrs) => {
    const node = document.createElementNS(SVG, name);
    for (const key of Object.keys(attrs || {})) node.setAttribute(key, String(attrs[key]));
    return node;
  };

  function build(block, kind) {
    const svg = make('svg', { class: 'bp-dim', 'aria-hidden': 'true', focusable: 'false' });
    const path = make('path', { d: '' });
    svg.append(path);
    const labels = [];
    const count = kind === 'block' ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const rect = make('rect', {});
      const text = make('text', { 'text-anchor': 'middle' });
      svg.append(rect, text);
      labels.push({ rect, text });
    }
    block.append(svg);
    return { block, kind, svg, path, labels, drawn: false, length: 0 };
  }

  function place(label, value, cx, cy, rotate) {
    const { text, rect } = label;
    text.textContent = value;
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    const transform = rotate ? `rotate(${rotate} ${cx} ${cy})` : '';
    if (transform) {
      text.setAttribute('transform', transform);
      rect.setAttribute('transform', transform);
    } else {
      text.removeAttribute('transform');
      rect.removeAttribute('transform');
    }
    let box = null;
    try {
      box = text.getBBox();
    } catch {
      box = null;
    }
    if (!box || !box.width) {
      const width = value.length * 7.4;
      box = { x: cx - width / 2, y: cy - 6, width, height: 12 };
    }
    rect.setAttribute('x', (box.x - 5).toFixed(1));
    rect.setAttribute('y', (box.y - 2).toFixed(1));
    rect.setAttribute('width', (box.width + 10).toFixed(1));
    rect.setAttribute('height', (box.height + 4).toFixed(1));
  }

  function layout(item) {
    const { block, svg, path, kind, labels } = item;
    const w = block.offsetWidth;
    const h = block.offsetHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`);
    svg.setAttribute('width', String(w + PAD * 2));
    svg.setAttribute('height', String(h + PAD * 2));

    // Drafting convention: extension lines off the part, a dimension line
    // outside it, oblique ticks at each end.
    const segments = [];
    const x = w + 12;
    if (kind === 'block') {
      const y = -12;
      segments.push(
        `M0 -3V${y - 6}`,
        `M${w} -3V${y - 6}`,
        `M-5 ${y}H${w + 5}`,
        `M-4 ${y + 4}l8 -8`,
        `M${w - 4} ${y + 4}l8 -8`,
      );
    }
    segments.push(
      `M${w + 3} 0H${x + 6}`,
      `M${w + 3} ${h}H${x + 6}`,
      `M${x} -5V${h + 5}`,
      `M${x - 4} 4l8 -8`,
      `M${x - 4} ${h + 4}l8 -8`,
    );
    path.setAttribute('d', segments.join(''));

    let length = 1600;
    try {
      length = Math.ceil(path.getTotalLength());
    } catch {
      length = 1600;
    }
    item.length = length;
    if (item.drawn) {
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = '0';
    } else {
      // Re-measuring an undrawn part must not flash: swap lengths with no transition.
      path.style.transition = 'none';
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      void path.getBoundingClientRect();
      path.style.transition = '';
    }

    let index = 0;
    if (kind === 'block') place(labels[index++], `${w} px`, w / 2, -12, 0);
    place(labels[index], `${h} px`, x, h / 2, -90);
  }

  function draw(item) {
    if (item.drawn) return;
    item.drawn = true;
    item.svg.classList.add('is-drawn');
    item.path.style.strokeDashoffset = '0';
  }

  function flush() {
    frame = 0;
    for (const item of pending) layout(item);
    pending.clear();
  }

  function schedule(item) {
    if (item) pending.add(item);
    else for (const each of items) pending.add(each);
    if (!frame) frame = window.requestAnimationFrame(flush);
  }

  return {
    mount({ reduceMotion } = {}) {
      motionless = Boolean(reduceMotion);
      const seen = new Set();
      for (const [selector, kind] of TARGETS) {
        for (const block of document.querySelectorAll(selector)) {
          if (seen.has(block) || block.closest('.skin-dock')) continue;
          seen.add(block);
          const item = build(block, kind);
          items.push(item);
          byBlock.set(block, item);
        }
      }
      for (const item of items) layout(item);

      if (motionless || typeof IntersectionObserver !== 'function') {
        for (const item of items) draw(item);
      } else {
        intersection = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const item = byBlock.get(entry.target);
              if (item) draw(item);
              intersection.unobserve(entry.target);
            }
          },
          { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
        );
        for (const item of items) intersection.observe(item.block);
      }

      if (typeof ResizeObserver === 'function') {
        resize = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const item = byBlock.get(entry.target);
            if (item) schedule(item);
          }
        });
        for (const item of items) resize.observe(item.block);
      } else {
        onWindowResize = () => schedule();
        window.addEventListener('resize', onWindowResize, { passive: true });
      }
    },

    unmount() {
      if (intersection) intersection.disconnect();
      if (resize) resize.disconnect();
      intersection = null;
      resize = null;
      if (onWindowResize) window.removeEventListener('resize', onWindowResize);
      onWindowResize = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      pending.clear();
      for (const item of items.splice(0)) item.svg.remove();
      byBlock.clear();
      motionless = false;
    },
  };
})();
