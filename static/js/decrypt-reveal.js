/* decrypt-reveal.js
 *
 * Scramble-reveal for real DOM text. Copy arrives as ordinary markup and is
 * briefly rewritten into cipher glyphs that resolve left to right, so the
 * page reads correctly with the script blocked, with JavaScript off, and for
 * anyone who asks for reduced motion.
 *
 * No build step, no dependencies. Loaded with `defer`.
 *
 * Opt out per element with data-no-decrypt (inherited by descendants).
 */
(function () {
  'use strict';

  if (window.__decryptReveal) return;
  window.__decryptReveal = true;

  var TARGETS = 'h1, h2, h3, .hero-statement, .lead, .engage-line';

  /* Never rewrite text that carries meaning as characters, or that another
     script owns. Checked per text node, so inline <code> inside a heading is
     left alone while the rest of the heading still resolves. */
  var SKIP_TAGS = {
    PRE: 1, CODE: 1, KBD: 1, SAMP: 1, SCRIPT: 1, STYLE: 1,
    TEXTAREA: 1, NOSCRIPT: 1, SVG: 1
  };
  var SKIP_CLASS = 'mermaid';

  /* Ordered narrow to wide by construction, but the real ordering is measured
     per font at runtime. Narrow glyphs matter: without them, thin letters like
     i and l have no legal substitute and would give the word shape away. */
  var CIPHER = "|.:,'^~_-/\\<>1+=*#%&$0123456789ABCDEF";

  var BAND = 7;
  var SEED_MS = 45;
  var STAGGER_MS = 55;
  var STYLE_ID = 'decrypt-reveal-style';

  function reduceMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Whole-page opt out. The sloptics page is typographic argument: its ASCII
     banner and its own stylesheet both make a scramble pass wrong there. */
  function pageOptedOut() {
    return !!document.querySelector('.sloptics-page');
  }

  function blocked(node, root) {
    var el = node.parentNode;
    while (el && el !== root.parentNode) {
      if (el.nodeType === 1) {
        if (SKIP_TAGS[el.tagName]) return true;
        if (el.classList && el.classList.contains(SKIP_CLASS)) return true;
        if (el.hasAttribute && el.hasAttribute('data-no-decrypt')) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function textNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var out = [];
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (blocked(node, root)) continue;
      out.push(node);
    }
    return out;
  }

  /* ---- Width-bounded cipher --------------------------------------------
     A glyph is only ever replaced by one that is no wider in the same font.
     Every line therefore stays at or below its original width, so text can
     never wrap onto an extra line and nothing below the element moves. The
     min-height pin covers the other direction, where a narrower cipher would
     otherwise let the box collapse. */

  var measureCtx = null;
  var widths = {};   // fontKey -> { char: advance }
  var ladders = {};  // fontKey -> { glyphs: [], widths: [] } sorted ascending

  function ctx() {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    return measureCtx;
  }

  function fontKey(el) {
    var cs = getComputedStyle(el);
    return cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  }

  function advance(key, ch) {
    var table = widths[key] || (widths[key] = {});
    if (table[ch] === undefined) {
      var c = ctx();
      c.font = key;
      table[ch] = c.measureText(ch).width;
    }
    return table[ch];
  }

  function ladder(key) {
    if (ladders[key]) return ladders[key];
    var seen = {};
    var list = [];
    for (var i = 0; i < CIPHER.length; i++) {
      var ch = CIPHER.charAt(i);
      if (seen[ch]) continue;
      seen[ch] = 1;
      list.push({ ch: ch, w: advance(key, ch) });
    }
    list.sort(function (a, b) { return a.w - b.w; });
    var built = { glyphs: [], widths: [] };
    for (var j = 0; j < list.length; j++) {
      built.glyphs.push(list[j].ch);
      built.widths.push(list[j].w);
    }
    return (ladders[key] = built);
  }

  /* Number of cipher glyphs no wider than `w`. */
  function fitCount(rungs, w) {
    var lo = 0;
    var hi = rungs.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (rungs[mid] <= w) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.is-cipher{transition:color .4s ease}' +
      '.is-cipher,.is-cipher *{color:var(--faint,#8a857c) !important}';
    document.head.appendChild(style);
  }

  function decrypt(el) {
    var nodes = textNodes(el);
    if (!nodes.length) return;

    var originals = nodes.map(function (n) { return n.nodeValue; });
    var total = originals.reduce(function (sum, s) { return sum + s.length; }, 0);
    if (!total) return;
    var duration = Math.min(520 + total * 1.2, 900);

    /* Per text node, because an inline <em> or <a> can carry its own face. */
    var fits = [];
    for (var i = 0; i < nodes.length; i++) {
      var host = nodes[i].parentNode;
      var key = host && host.nodeType === 1 ? fontKey(host) : fontKey(el);
      var rungs = ladder(key);
      var src = originals[i];
      var row = new Array(src.length);
      for (var c = 0; c < src.length; c++) {
        row[c] = fitCount(rungs.widths, advance(key, src.charAt(c)));
      }
      fits.push({ rungs: rungs, counts: row });
    }

    var block = getComputedStyle(el).display !== 'inline';
    if (block) el.style.minHeight = el.getBoundingClientRect().height + 'px';
    el.classList.add('is-cipher');

    var noise = new Array(total);
    function reseed() {
      var offset = 0;
      for (var i = 0; i < nodes.length; i++) {
        var src = originals[i];
        var f = fits[i];
        for (var c = 0; c < src.length; c++) {
          var n = f.counts[c];
          /* Nothing legal fits under this glyph: leave it alone rather than
             risk a wider substitute. */
          noise[offset + c] = n > 0
            ? f.rungs.glyphs[(Math.random() * n) | 0]
            : src.charAt(c);
        }
        offset += src.length;
      }
    }
    reseed();

    var start = performance.now();
    var lastSeed = start;

    function frame(now) {
      var p = Math.min((now - start) / duration, 1);
      if (now - lastSeed > SEED_MS) { reseed(); lastSeed = now; }
      var head = p * (total + BAND);
      var offset = 0;
      for (var i = 0; i < nodes.length; i++) {
        var src = originals[i];
        if (head - offset >= src.length + BAND) {
          if (nodes[i].nodeValue !== src) nodes[i].nodeValue = src;
          offset += src.length;
          continue;
        }
        var out = '';
        for (var c = 0; c < src.length; c++) {
          var ch = src.charAt(c);
          if (ch === ' ' || ch === '\n' || ch === '\t') { out += ch; continue; }
          out += offset + c < head - BAND ? ch : noise[offset + c];
        }
        nodes[i].nodeValue = out;
        offset += src.length;
      }
      if (p < 1) { requestAnimationFrame(frame); return; }
      for (var j = 0; j < nodes.length; j++) nodes[j].nodeValue = originals[j];
      el.classList.remove('is-cipher');
      if (block) el.style.minHeight = '';
    }
    requestAnimationFrame(frame);
  }

  function eligible(el) {
    if (el.dataset.decrypted) return false;
    if (el.closest('[data-no-decrypt]')) return false;
    if (el.closest('pre, code, .mermaid')) return false;
    return !!(el.textContent && el.textContent.trim());
  }

  function boot() {
    if (pageOptedOut()) return;

    var all = document.querySelectorAll(TARGETS);
    var els = [];
    for (var i = 0; i < all.length; i++) {
      if (eligible(all[i])) {
        all[i].dataset.decrypted = '1';
        els.push(all[i]);
      }
    }
    if (!els.length) return;

    /* No reveal without motion: the text is already correct in the DOM. */
    if (reduceMotion()) return;

    injectStyle();

    var observer = new IntersectionObserver(function (entries, obs) {
      var slot = 0;
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var el = entry.target;
        if (!entry.isIntersecting) {
          /* Already scrolled past (reload at an offset, deep link, instant
             jump): drop it rather than animate off screen. */
          if (entry.boundingClientRect.bottom < 0) obs.unobserve(el);
          continue;
        }
        obs.unobserve(el);
        (function (target, delay) {
          setTimeout(function () { decrypt(target); }, delay);
        })(el, slot++ * STAGGER_MS);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });

    for (var k = 0; k < els.length; k++) {
      if (els[k].getBoundingClientRect().bottom < 0) continue;
      observer.observe(els[k]);
    }
  }

  /* Measure against the real webfonts, so both the pinned height and the
     glyph ladder come from the face the reader actually sees. */
  function ready() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(boot).catch(boot);
    } else {
      boot();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();
