(window.oceanheartSkinEffects = window.oceanheartSkinEffects || {})['acid-index'] = (() => {
  const touched = [];
  return {
    mount() {
      document
        .querySelectorAll('.entry, .post-item, .tells-row, .service-row, .proof-row')
        .forEach((record, index) => {
          record.style.setProperty('--record-tilt', `${index % 2 === 0 ? -0.45 : 0.45}deg`);
          record.dataset.record = String(index + 1).padStart(2, '0');
          touched.push(record);
        });
    },
    unmount() {
      for (const record of touched.splice(0)) {
        record.style.removeProperty('--record-tilt');
        delete record.dataset.record;
      }
    },
  };
})();
