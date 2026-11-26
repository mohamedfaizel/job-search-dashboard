/**
 * Who runs Job Search Hunter, for the Impressum and the privacy policy. The postal address comes
 * from NEXT_PUBLIC_LEGAL_ADDRESS (lines split by "|"); until it is set, both pages show a clear
 * "address missing" note instead, so nobody forgets it before the site goes live.
 */
export const LEGAL = {
  name: 'Mohamed Faizel Mohamed Abdullah',
  email: 'mohamedfaizel.js@gmail.com',
  address: (process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? '')
    .split('|')
    .map((line) => line.trim())
    .filter(Boolean),
  /** When the privacy policy last changed (shown on the page). */
  updated: '2026-11-26',
} as const;
