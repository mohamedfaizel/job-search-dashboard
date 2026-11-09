/** The web app's colours: black bars, German gold, red for warnings. */
export const colors = {
  black: '#111111',
  gold: '#FFCE00',
  red: '#DD0000',
  text: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  page: '#F1F5F9',
  white: '#FFFFFF',
  green: '#047857',
  greenBg: '#ECFDF5',
  orange: '#B45309',
  orangeBg: '#FFFBEB',
  redText: '#B91C1C',
  redBg: '#FEF2F2',
} as const;

/** Fit % colours, the same steps as the web: 75+ green, 50+ orange, below red. */
export function fitColors(score: number): { fg: string; bg: string } {
  if (score >= 75) return { fg: colors.green, bg: colors.greenBg };
  if (score >= 50) return { fg: colors.orange, bg: colors.orangeBg };
  return { fg: colors.redText, bg: colors.redBg };
}
