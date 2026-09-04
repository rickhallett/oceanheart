(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['packet-garden'] = (() => {
  let field = null;
  return {
    mount() {
      field = document.createElement('div');
      field.className = 'packet-field';
      field.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < 18; index += 1) {
        const node = document.createElement('i');
        node.style.setProperty('--node-x', `${(index * 37) % 96}%`);
        node.style.setProperty('--node-y', `${(index * 61) % 92}%`);
        node.style.setProperty('--node-size', `${5 + (index % 4) * 3}px`);
        field.append(node);
      }
      document.body.prepend(field);
    },
    unmount() {
      field?.remove();
      field = null;
    },
  };
})();
