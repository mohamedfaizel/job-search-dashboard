import { adContext, bestSkillsLine, closeSpelling, placeFor, placesFor } from './keywordPlace';
import { linesWith, replaceWordInLine } from './replyEdit';

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

describe('placesFor', () => {
  it('gives up to 3 lines, best first, and none when no line shares a word', () => {
    const ad = 'You build React dashboards in CI pipelines, mentoring juniors, with Kubernetes.';
    expect(placesFor(RESUME, 'Kubernetes', ad).map((p) => p.line)).toEqual([2, 4, 3]);
    expect(placesFor(RESUME, 'Avionics', AD)).toEqual([]);
  });
});

describe('closeSpelling', () => {
  it('finds the keyword in another spelling or a short form', () => {
    expect(closeSpelling('- Ran Kubernets clusters', 'Kubernetes')).toBe('Kubernets');
    expect(closeSpelling('- Ran K8s clusters', 'Kubernetes')).toBe('K8s');
    expect(closeSpelling('- Wrote Typscript code', 'TypeScript')).toBe('Typscript');
    expect(closeSpelling('- Built Google Clod tools', 'Google Cloud')).toBe('Google Clod');
  });

  it('leaves words that only look alike, and keywords the resume already names', () => {
    expect(closeSpelling('- Wrote Java services', 'JavaScript')).toBeNull();
    expect(closeSpelling('- Wrote Node.js services', 'NodeJS')).toBeNull();
    expect(closeSpelling('- Built React apps', 'Redux')).toBeNull();
  });
});

describe('bestSkillsLine', () => {
  const GROUPED = `# Ada
## Skills
- Frontend: React, TypeScript, Next.js
- Testing: Jest, Playwright
## Experience
- Built dashboards in React`;

  it('picks the Skills group whose words the ad uses around the keyword', () => {
    const ad = 'You write tests with Vitest and Playwright.';
    expect(bestSkillsLine(GROUPED, 'Vitest', ad)).toBe(3);
    expect(bestSkillsLine(GROUPED, 'Svelte', 'You build Svelte and React apps.')).toBe(2);
  });

  it('falls back to the first Skills line, or -1 without a Skills section', () => {
    expect(bestSkillsLine(GROUPED, 'Kafka', 'Kafka streams.')).toBe(2);
    expect(bestSkillsLine('# Ada\n## Experience\n- Built apps', 'Kafka', '')).toBe(-1);
  });
});

describe('replaceWordInLine', () => {
  it('changes only the chosen line', () => {
    const text = '- Jest tests\n- More Jest tests';
    expect(linesWith(text, 'jest')).toEqual([0, 1]);
    expect(replaceWordInLine(text, 1, 'Jest', 'Vitest')).toBe('- Jest tests\n- More Vitest tests');
  });
});
