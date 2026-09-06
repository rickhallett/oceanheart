export type Practice = 'dev';
export const flagshipNavigation = [['The practice', '/practice'], ['Sessions', '/sessions'], ['Events', '/events'], ['About Rick', '/about']] as const;
export const practiceNavigation = {
 dev: [['AI guidance', '/conversations-with-ai'], ['Selected work', '/selected-work'], ['Engineering', '/engineering'], ['Contact', 'mailto:rick@oceanheart.ai']],
} as const;
