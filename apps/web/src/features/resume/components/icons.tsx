/** Small line icons for the builder's buttons. Decorative: each button has its own label. */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const GripIcon = () => (
  <svg {...base} stroke="none" fill="currentColor">
    <circle cx="6" cy="4" r="1.2" />
    <circle cx="10" cy="4" r="1.2" />
    <circle cx="6" cy="8" r="1.2" />
    <circle cx="10" cy="8" r="1.2" />
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="10" cy="12" r="1.2" />
  </svg>
);
export const UpIcon = () => (
  <svg {...base}>
    <path d="M4 10l4-4 4 4" />
  </svg>
);
export const DownIcon = () => (
  <svg {...base}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);
export const EyeIcon = () => (
  <svg {...base}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);
export const EyeOffIcon = () => (
  <svg {...base}>
    <path d="M2 2l12 12M6.5 4a6.4 6.4 0 011.5-.5c4 0 6.5 4.5 6.5 4.5a11 11 0 01-1.9 2.4M4.2 5.2A11 11 0 001.5 8S4 12.5 8 12.5c1 0 1.9-.3 2.7-.7" />
  </svg>
);
export const CopyIcon = () => (
  <svg {...base}>
    <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
    <path d="M10.5 5V3.5A1.5 1.5 0 009 2H3.5A1.5 1.5 0 002 3.5V9A1.5 1.5 0 003.5 10.5H5" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...base}>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
  </svg>
);
export const XIcon = () => (
  <svg {...base}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
export const LockIcon = () => (
  <svg {...base}>
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);
export const TickIcon = () => (
  <svg {...base}>
    <path d="M3 8.5l3.2 3.2L13 4.8" />
  </svg>
);
export const RefreshIcon = () => (
  <svg {...base}>
    <path d="M13 8a5 5 0 1 1-1.6-3.7" />
    <path d="M13 2.5v3h-3" />
  </svg>
);
export const LinkIcon = () => (
  <svg {...base}>
    <path d="M6.5 9.5l3-3" />
    <path d="M7 4.5l.8-.8a2.5 2.5 0 0 1 3.5 3.5l-.8.8" />
    <path d="M9 11.5l-.8.8a2.5 2.5 0 0 1-3.5-3.5l.8-.8" />
  </svg>
);
export const EraserIcon = () => (
  <svg {...base}>
    <path d="M9.5 3l3.5 3.5-6 6H4L2.5 11l7-8z" />
    <path d="M6 7l3.5 3.5" />
  </svg>
);
export const PencilIcon = () => (
  <svg {...base}>
    <path d="M10.5 2.5l3 3L6 13H3v-3z" />
  </svg>
);
