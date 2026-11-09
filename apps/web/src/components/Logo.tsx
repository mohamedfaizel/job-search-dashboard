const BLACK = '#111111';
const RED = '#dd0000';
const GOLD = '#ffce00';
const WHITE = '#ffffff';

const LINE = { stroke: BLACK, strokeWidth: 1.36, strokeLinecap: 'round' } as const;

/**
 * The app's logo: a bullseye in the German flag colours (black, red, gold rings) with a resume in
 * the gold centre, hit by an arrow ("we hunt the right job for your resume"). `onDark` draws a
 * white edge on the outer ring and a white arrow, so it still shows on the black header. The same
 * drawing is the browser tab icon (src/app/icon.svg).
 */
export function Logo({
  className = 'h-7 w-7',
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const shaft = onDark ? WHITE : BLACK;
  const halo = onDark ? BLACK : WHITE;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle
        cx="32"
        cy="33"
        r="29"
        fill={BLACK}
        stroke={onDark ? WHITE : 'none'}
        strokeWidth="1.6"
      />
      <circle cx="32" cy="33" r="21.5" fill={RED} />
      <circle cx="32" cy="33" r="14" fill={GOLD} />
      {/* The resume page */}
      <rect
        x="24.5"
        y="23.5"
        width="15"
        height="19"
        rx="1.2"
        fill={WHITE}
        stroke={BLACK}
        strokeWidth="1.1"
      />
      <rect x="27.2" y="26.2" width="3.9" height="3.9" rx="0.6" fill={RED} />
      <line x1="32.6" y1="27.3" x2="36.8" y2="27.3" {...LINE} />
      <line x1="32.6" y1="29.5" x2="35" y2="29.5" {...LINE} opacity="0.6" />
      <line x1="27.2" y1="34.5" x2="36.8" y2="34.5" {...LINE} opacity="0.6" />
      <line x1="27.2" y1="37.2" x2="36.8" y2="37.2" {...LINE} opacity="0.6" />
      <line x1="27.2" y1="39.8" x2="33.5" y2="39.8" {...LINE} opacity="0.6" />
      {/* The arrow: a halo first so it reads on every ring, then feathers, shaft and head */}
      <line
        x1="38.5"
        y1="26.5"
        x2="61"
        y2="4"
        stroke={halo}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <polygon
        points="33,32 41.5,29.5 35.5,23.5"
        fill={halo}
        stroke={halo}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <polygon
        points="54,11 60,5 64,7.5 58,13.5"
        fill={RED}
        stroke={halo}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <polygon
        points="54,11 60,5 57.5,1 51.5,7"
        fill={GOLD}
        stroke={halo}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <line
        x1="38.5"
        y1="26.5"
        x2="61"
        y2="4"
        stroke={shaft}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <polygon points="33,32 41.5,29.5 35.5,23.5" fill={shaft} />
    </svg>
  );
}
