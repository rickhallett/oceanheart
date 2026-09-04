/*
  Doors landing: one page, a different first door depending on where the
  visitor came from. ?from=swanage|ai|systems reorders the doors and rewrites
  the hero; the draft strip (draft builds only) simulates the same thing.
*/
(() => {
  const entries = {
    home: {
      h1: 'I work where the change actually has to happen.',
      lead: 'Sometimes that is a body that will not settle. Sometimes it is a conversation nobody has had yet. Sometimes it is a system that keeps breaking. Increasingly it is a person meeting AI for the first time and wondering what to trust.',
      context: 'Fifteen years as a therapist. Six years shipping production software. Two years working with AI every day. One practice, several doors.',
      cta: 'Choose a door',
      order: ['body', 'integrative', 'ai', 'systems'],
      first: '',
      contact: 'Not sure which door? Start with the conversation.',
      subject: 'Not sure yet',
      facebook: false,
    },
    swanage: {
      h1: 'A warm, private treatment room in a Swanage garden.',
      lead: 'Massage that puts the nervous system first, with plain boundaries agreed before you arrive. Local, low fuss, and coming to your door later in the year.',
      context: 'Fifteen years in clinical practice. Newly trained in bodywork, with the details stated exactly on the booking page. You probably already know me from around town.',
      cta: 'Tell me when booking opens',
      order: ['body', 'integrative', 'ai', 'systems'],
      first: 'body',
      contact: 'Want to know when the room opens?',
      subject: 'I want to come in person',
      facebook: true,
    },
    ai: {
      h1: 'Learn to work with AI by working with AI, while watching yourself do it.',
      lead: 'Conversations with AI is a guided encounter with a frontier model. I am in the loop from the first exchange, and I follow up personally after every use. Therapists and wellbeing practitioners first.',
      context: 'Fifteen years as a therapist. Six years shipping production software. Two years working with AI every day.',
      cta: 'Take part in v0.1',
      order: ['ai', 'systems', 'body', 'integrative'],
      first: 'ai',
      contact: 'Curious but not ready to take part? Ask me anything.',
      subject: 'Conversations with AI',
      facebook: false,
    },
    systems: {
      h1: 'I can hold the relationship and debug the system.',
      lead: 'For founders, teams, and practitioners whose business has outgrown spreadsheets, copied messages, disconnected tools, and AI experiments they cannot trust.',
      context: 'Fifteen years as a therapist taught me how to find the real problem with people. Production engineering taught me how to build, ship, and support the answer.',
      cta: 'Send me the untidy version',
      order: ['systems', 'ai', 'body', 'integrative'],
      first: 'systems',
      contact: 'What keeps repeating, who handles it, and where does it break?',
      subject: 'The work that keeps repeating',
      facebook: false,
    },
  };

  const list = document.querySelector('[data-door-list]');
  const mail = document.querySelector('[data-mail-link]');
  const facebook = document.querySelector('[data-facebook-link]');
  const preview = document.querySelector('[data-subject-preview]');
  const intents = [...document.querySelectorAll('.intent [data-subject]')];
  const strip = [...document.querySelectorAll('[data-doors-strip] [data-entry]')];
  if (!list || !mail) return;

  const text = (key, value) => {
    const node = document.querySelector(`[data-doors="${key}"]`);
    if (node) node.textContent = value;
  };

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
    text('h1', entry.h1);
    text('lead', entry.lead);
    text('context', entry.context);
    text('cta', entry.cta);
    text('contact', entry.contact);
    for (const name of entry.order) {
      const door = list.querySelector(`[data-door="${name}"]`);
      if (!door) continue;
      door.classList.toggle('is-first', entry.first === name);
      list.append(door);
    }
    setSubject(entry.subject);
    if (facebook) facebook.hidden = !entry.facebook;
    for (const button of strip) {
      button.setAttribute('aria-pressed', String(button.dataset.entry === key));
    }
  }

  for (const button of intents) {
    button.addEventListener('click', () => setSubject(button.dataset.subject));
  }
  for (const button of strip) {
    button.addEventListener('click', () => applyEntry(button.dataset.entry));
  }

  let from = 'home';
  try {
    from = new URLSearchParams(window.location.search).get('from') || 'home';
  } catch {
    from = 'home';
  }
  if (from !== 'home') applyEntry(from);
})();
