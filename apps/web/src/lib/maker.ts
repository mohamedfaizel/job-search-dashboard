/**
 * The person who built Job Search Hunter. The intro page, the About us page and the footer
 * show this name and photo. The links are optional: leave an env var empty and its button
 * is hidden.
 */
export const MAKER = {
  name: 'Mohamed Faizel',
  /** A small round photo (footer) and the big desk photo (intro and About us). */
  face: '/site/maker-face.jpg',
  photo: '/site/maker.jpg',
  github: process.env.NEXT_PUBLIC_MAKER_GITHUB_URL ?? 'https://github.com/mohamedfaizel',
  linkedin: process.env.NEXT_PUBLIC_MAKER_LINKEDIN_URL ?? '',
} as const;

/** The demo video. Until it is set, the intro page hides its "Watch the demo" button. */
export const DEMO_VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '';
