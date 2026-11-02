const BLACK = '#111111';
const RED = '#dd0000';
const GOLD = '#ffce00';

/**
 * The app's logo: two job cards (gold behind, black in front), with a red search lens holding a
 * tick over the top one ("found it, applied"): black, red and gold, the German flag. The same
 * drawing is the browser tab icon (src/app/icon.svg).
 */
export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect x="5" y="9" width="24" height="31" rx="4" fill={GOLD} transform="rotate(-9 17 24)" />
      <rect x="12" y="5" width="25" height="32" rx="4" fill={BLACK} />
      <rect x="17" y="11" width="15" height="3" rx="1.5" fill="#fff" />
      <rect x="17" y="17" width="10" height="2.5" rx="1.25" fill="#fff" opacity="0.7" />
      <rect x="17" y="22" width="7" height="2.5" rx="1.25" fill="#fff" opacity="0.7" />
      <circle cx="32" cy="31" r="9" fill="#fff" />
      <circle cx="32" cy="31" r="9" fill="none" stroke={RED} strokeWidth="3.2" />
      <path
        d="M28.2 31.2l2.7 2.7 5-5.2"
        fill="none"
        stroke={BLACK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M38.6 37.6l5 5" stroke={RED} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
