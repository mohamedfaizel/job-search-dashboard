import { notInResume } from './not-in-resume';

const RESUME = 'Built React.js apps in TypeScript. Node.js and C++ on the side. Worked at Google.';

describe('notInResume', () => {
  it('lists what the resume never mentions, as whole words and ignoring case', () => {
    expect(notInResume('react, typescript, Kubernetes, SAP', RESUME)).toEqual([
      'Kubernetes',
      'SAP',
    ]);
  });

  it('does not find a word inside a longer one', () => {
    expect(notInResume('Go, Node.js, C++', RESUME)).toEqual(['Go']);
  });

  it('says nothing without a resume', () => {
    expect(notInResume('React, SAP', '  ')).toEqual([]);
  });
});
