import { adContext, placeFor } from './keywordPlace';

const RESUME = `# Ada
## Experience
- Built dashboards in React and GraphQL
- Ran Docker containers in CI pipelines for twelve services
- Mentored two junior developers
## Skills
- React, TypeScript`;

const AD = `You build dashboards. You deploy services as containers with Kubernetes and CI pipelines.
You enjoy mentoring.`;

describe('placeFor', () => {
  it('takes the ad words around the keyword, without the keyword itself', () => {
    const words = adContext(AD, 'Kubernetes');
    expect(words.has('container')).toBe(true);
    expect(words.has('kubernet')).toBe(false);
    expect(words.has('dashboards')).toBe(false);
  });

  it('picks the bullet that shares the most words with the ad sentence about the keyword', () => {
    const place = placeFor(RESUME, 'Kubernetes', AD);
    expect(place.line).toBe(3);
    expect(place.words).toEqual(expect.arrayContaining(['containers', 'pipelines', 'services']));
  });

  it('counts the related skill extra, and falls back to it when no word is shared', () => {
    expect(placeFor(RESUME, 'Vitest', '', 'GraphQL')).toEqual({ line: 2, words: ['GraphQL'] });
    expect(placeFor(RESUME, 'Avionics', AD)).toEqual({ line: 2, words: [] });
  });
});
