import { describe, expect, it } from 'vitest';
import { buildResumePrompt } from './prompt';
import { coverage, matchScore } from './score';
import { mentions, spellings } from './skills';
import { detectLanguage, keywordTokens, stopwordsFor, tokenize } from './text';
import { documentFrequencies, rankTerms } from './tfidf';

describe('detectLanguage', () => {
  it('tells German from English', () => {
    expect(
      detectLanguage('Wir suchen einen erfahrenen Frontend Entwickler mit sehr guten Kenntnissen'),
    ).toBe('de');
    expect(
      detectLanguage('We are looking for an experienced frontend engineer to join our team'),
    ).toBe('en');
  });

  it('gives up on text too short to tell', () => {
    expect(detectLanguage('React developer')).toBeNull();
    expect(detectLanguage(null)).toBeNull();
  });
});

describe('tokenize', () => {
  it('keeps tech words whole and drops stopwords, numbers and full stops', () => {
    const words = tokenize(
      'We use Node.js, C++ and C# with CI-CD. You have 5 years of React.',
      stopwordsFor('en'),
    );
    expect(words).toEqual(['node.js', 'c++', 'c#', 'ci-cd', 'react']);
  });

  it('uses the stopwords of the job’s language', () => {
    expect(tokenize('Wir suchen einen Kafka Experten', stopwordsFor('de'))).toEqual([
      'kafka',
      'experten',
    ]);
  });
});

describe('keywordTokens', () => {
  it('keeps only nouns and tech words in German, without gender endings', () => {
    expect(
      keywordTokens('Du bietest Erfahrung mit Kafka, c++ und arbeitest mit Entwickler*innen', 'de'),
    ).toEqual(['kafka', 'c++', 'entwickler']);
  });

  it('keeps every word in English', () => {
    expect(keywordTokens('You will design scalable microservices', 'en')).toEqual([
      'design',
      'scalable',
      'microservices',
    ]);
  });
});

describe('mentions', () => {
  const resume = 'Built APIs in NodeJS and TypeScript. Some Java. CI/CD with GitHub Actions.';

  it('finds a skill in any accepted spelling', () => {
    expect(mentions(resume, 'node.js')).toBe(true);
    expect(mentions(resume, 'typescript')).toBe(true);
    expect(mentions(resume, 'ci-cd')).toBe(true);
  });

  it('matches whole words only', () => {
    expect(mentions('JavaScript developer', 'java')).toBe(false);
    expect(mentions('C++ developer', 'c')).toBe(false);
    expect(mentions(resume, 'kafka')).toBe(false);
  });

  it('lists the spellings of a tag', () => {
    expect(spellings('ci-cd')).toEqual(['ci-cd', 'ci cd', 'ci/cd', 'continuous integration']);
  });
});

describe('rankTerms', () => {
  it('ranks words that are rare across the collection above common ones', () => {
    const docs = [
      ['team', 'react', 'kafka', 'kafka'],
      ['team', 'react'],
      ['team', 'vue'],
    ];
    const ranked = rankTerms(docs[0]!, documentFrequencies(docs)).map((r) => r.term);
    expect(ranked).toEqual(['kafka', 'react', 'team']);
  });
});

describe('matchScore', () => {
  it('weighs skills 60% and keywords 40%', () => {
    expect(matchScore(50, 100)).toBe(70);
  });

  it('uses the one list a job has', () => {
    expect(matchScore(null, 40)).toBe(40);
    expect(matchScore(80, null)).toBe(80);
    expect(matchScore(null, null)).toBeNull();
  });

  it('turns found terms into a percent', () => {
    expect(
      coverage([
        { term: 'a', inResume: true },
        { term: 'b', inResume: false },
        { term: 'c', inResume: false },
      ]),
    ).toBe(33);
    expect(coverage([])).toBeNull();
  });
});

describe('buildResumePrompt', () => {
  const input = {
    title: 'Frontend Entwickler',
    company: 'Acme',
    city: 'Berlin',
    language: 'de',
    missingSkills: ['kafka'],
    missingKeywords: ['microfrontends'],
    resume: 'React developer since 2019.',
    description: 'Wir suchen …',
  };

  it('asks for the job’s language and lists what is missing', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain('Job: Frontend Entwickler at Acme in Berlin');
    expect(prompt).toContain('Write the whole resume in German');
    expect(prompt).toContain('- kafka');
    expect(prompt).toContain('- microfrontends');
    expect(prompt).toContain('React developer since 2019.');
    expect(prompt).toContain('Never invent');
  });

  it('asks Claude to request the resume when there is none', () => {
    const prompt = buildResumePrompt({ ...input, resume: ' ', missingSkills: [], language: null });
    expect(prompt).toContain('Ask me for it before you start');
    expect(prompt).toContain('- (none)');
    expect(prompt).toContain('Write the resume in the language of the job ad');
  });
});
