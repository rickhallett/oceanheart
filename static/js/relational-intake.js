/*
  Data-minimal relational intake. The form never posts to the site. It builds a
  mailto draft locally, then leaves the visitor to review and send it from their
  own mail application.
*/
(() => {
  const form = document.querySelector('[data-intake-form]');
  const prepared = document.querySelector('[data-intake-prepared]');
  const mail = document.querySelector('[data-intake-mail]');
  const summary = document.querySelector('[data-intake-summary]');
  if (!form || !prepared || !mail) return;

  const value = (data, key) => String(data.get(key) || '').trim();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = value(data, 'name');
    const audience = value(data, 'for');
    const format = value(data, 'format');
    const context = value(data, 'context');
    const recipient = form.dataset.recipient;
    const subject = 'Direct relational work enquiry';
    const lines = [
      'Hello Rick,',
      '',
      'I am getting in touch about direct relational work.',
      '',
      `Name: ${name}`,
      `This is for: ${audience}`,
      `Preferred format: ${format}`,
    ];

    if (context) lines.push(`One-sentence context: ${context}`);
    lines.push('', 'I have kept this first message free of health history and confidential details.');

    mail.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    prepared.hidden = false;
    if (summary) summary.textContent = `Ready for ${name}. Nothing has been sent.`;
    mail.focus({ preventScroll: true });
  });

  form.addEventListener('input', () => {
    prepared.hidden = true;
  });
})();
