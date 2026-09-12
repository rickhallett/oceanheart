export type Practice = 'dev';
export const flagshipNavigation = [['The practice', '/practice'], ['Events', '/events'], ['Studio', '/studio'], ['The technical bit', '/the-technical-bit']] as const;
export const flagshipFooterNavigation = [['The practice', '/practice'], ['Sessions', '/sessions'], ['Events', '/events'], ['Consulting', '/consulting'], ['About Rick', '/about'], ['Studio', '/studio'], ['The technical bit', '/the-technical-bit']] as const;
export const practiceNavigation = {
 dev: [['Consulting', '/consulting'], ['AI guidance', '/conversations-with-ai'], ['Selected work', '/selected-work'], ['Engineering', '/engineering'], ['Contact', 'mailto:rick@oceanheart.ai']],
} as const;
