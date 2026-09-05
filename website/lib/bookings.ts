/** Public appointment links. AI pilot sessions use email until a URL is supplied. */
export const calendarUrls = {
  therapy: 'https://calendar.app.google/ngvknrqTVXAzCdNTA',
  massage: 'https://calendar.app.google/mPD7C1uLA3xTxyoy5',
  ai: '',
  digital: 'https://calendar.app.google/7uNx5L7V89sq7haW9',
  exploration: 'https://calendar.app.google/ZBefmABrzWXnqkMYA',
} satisfies Record<string, string>;

export type BookingKind = 'therapy' | 'massage' | 'ai' | 'digital' | 'exploration';

const options = {
  therapy: { calendar: 'therapy', label: 'Book therapy', emailLabel: 'Request a therapy session', subject: 'Therapy session enquiry' },
  massage: { calendar: 'massage', label: 'Book massage / bodywork', emailLabel: 'Request a massage session', subject: 'Massage session enquiry' },
  ai: { calendar: 'ai', label: 'Join the free AI pilot', emailLabel: 'Join the free AI pilot', subject: 'Conversations with AI — free pilot session' },
  digital: { calendar: 'digital', label: 'Free digital consultation', emailLabel: 'Request a free digital consultation', subject: 'Digital project — free exploration conversation' },
  exploration: { calendar: 'exploration', label: 'Free exploration call', emailLabel: 'Request a free exploration conversation', subject: 'Free exploration conversation' },
} as const;

export function bookingLink(kind: BookingKind) {
  const option = options[kind];
  const calendarUrl = calendarUrls[option.calendar];
  return {
    href: calendarUrl || `mailto:rick@oceanheart.ai?subject=${encodeURIComponent(option.subject)}`,
    label: calendarUrl ? option.label : option.emailLabel,
    isCalendar: Boolean(calendarUrl),
  };
}
