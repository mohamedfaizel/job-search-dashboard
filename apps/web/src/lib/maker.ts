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
  linkedin:
    process.env.NEXT_PUBLIC_MAKER_LINKEDIN_URL ?? 'https://www.linkedin.com/in/mohamedfaizel',
  /** The 2-minute demo video (YouTube or a video file). Empty: the demo button is hidden. */
  demoVideo: process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '',
} as const;
