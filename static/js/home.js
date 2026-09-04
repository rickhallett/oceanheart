/*
  Founder-led homepage routing. The hero remains immutable. A source hint may
  reorder the three doors and prime the contact subject, but it never changes
  Rick's identity or the claims on the page.
*/
(() => {
  const entries = {
    home: {
      order: ['ai', 'systems', 'relational'],
      first: '',
      contact: 'Not sure which door? Start with the conversation.',
      subject: 'Not sure yet',
    },
    ai: {
      order: ['ai', 'systems', 'relational'],
      first: 'ai',
      contact: 'Curious about Conversations with AI? Start with the conversation.',
      subject: 'Conversations with AI',
    },
    systems: {
      order: ['systems', 'ai', 'relational'],
      first: 'systems',
      contact: 'Bring me the system that keeps breaking.',
      subject: 'A system that keeps breaking',
    },
  };

  const list = document.querySelector('[data-door-list]');
  const mail = document.querySelector('[data-mail-link]');
  const preview = document.querySelector('[data-subject-preview]');
  const intents = [...document.querySelectorAll('.intent [data-subject]')];
  const contactRoutes = [...document.querySelectorAll('[data-contact-subject]')];
  if (!list || !mail) return;

  function setSubject(subject) {
    const email = mail.getAttribute('href').split('?')[0];
    mail.setAttribute('href', `${email}?subject=${encodeURIComponent(subject)}`);
    if (preview) preview.textContent = subject;
    for (const button of intents) {
      button.setAttribute('aria-pressed', String(button.dataset.subject === subject));
    }
  }

  function applyEntry(key) {
    const entry = entries[key] || entries.home;
    const contact = document.querySelector('[data-doors="contact"]');
    if (contact) contact.textContent = entry.contact;
    for (const name of entry.order) {
      const door = list.querySelector(`[data-door="${name}"]`);
      if (!door) continue;
      door.classList.toggle('is-first', entry.first === name);
      list.append(door);
    }
    setSubject(entry.subject);
  }

  for (const button of intents) {
    button.addEventListener('click', () => setSubject(button.dataset.subject));
  }
  for (const link of contactRoutes) {
    link.addEventListener('click', () => setSubject(link.dataset.contactSubject));
  }

  let from = 'home';
  try {
    from = new URLSearchParams(window.location.search).get('from') || 'home';
  } catch {
    from = 'home';
  }
  applyEntry(from);
})();
