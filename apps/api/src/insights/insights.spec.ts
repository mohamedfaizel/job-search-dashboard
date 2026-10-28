import { describe, expect, it } from 'vitest';
import { buildResumePrompt } from './prompt';
import { checkResume, coverage, matchScore, titleMatch } from './score';
import { KNOWN_SKILLS, mentions, relatedTo, spellings } from './skills';
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

describe('relatedTo', () => {
  it('names the skill you have that a missing term goes with', () => {
    expect(relatedTo('apollo', 'GraphQL APIs in NodeJS')).toBe('graphql');
    expect(relatedTo('Next.js', 'Five years of ReactJS')).toBe('react');
  });

  it('gives nothing when no related skill is there', () => {
    expect(relatedTo('apollo', 'REST APIs')).toBeNull();
    expect(relatedTo('cobol', 'GraphQL')).toBeNull();
  });

  it('knows tool names, so they can rank above plain words', () => {
    expect(KNOWN_SKILLS.has('apollo')).toBe(true);
    expect(KNOWN_SKILLS.has('module federation')).toBe(true);
    expect(KNOWN_SKILLS.has('business')).toBe(false);
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
  it('weighs the parts like Resume-Matcher, with sections and dates full', () => {
    // 40% × 50 + 20% × 100 + 15% × 0 + 25% × 100 = 65
    expect(matchScore({ keywords: 50, skills: 100, title: 0 })).toBe(65);
    expect(matchScore({ keywords: 100, skills: 100, title: 100 })).toBe(100);
  });

  it('shares the weight of a part with nothing to check', () => {
    // No skills: 40% × 0 + 15% × 0 + 25% × 100, out of 80%
    expect(matchScore({ keywords: 0, skills: null, title: 0 })).toBe(31);
    expect(matchScore({ keywords: null, skills: null, title: null })).toBeNull();
  });

  it('turns found terms into a percent', () => {
    expect(
      coverage([
        { term: 'a', inResume: true, relatedTo: null },
        { term: 'b', inResume: false, relatedTo: null },
        { term: 'c', inResume: false, relatedTo: null },
      ]),
    ).toBe(33);
    expect(coverage([])).toBeNull();
  });
});

describe('checkResume', () => {
  const job = {
    skills: ['kafka', 'react'],
    keywords: ['microservices'],
    title: 'Backend Engineer',
    language: 'en',
  };

  it('scores any resume text the same way', () => {
    const check = checkResume('Backend Engineer: Kafka and microservices', job);
    expect(check.skillChecks).toEqual([
      { term: 'kafka', inResume: true, relatedTo: null },
      { term: 'react', inResume: false, relatedTo: null },
    ]);
    expect(check).toMatchObject({ skills: 50, keywords: 100, title: 100 });
    expect(check.score).toBe(matchScore({ skills: 50, keywords: 100, title: 100 }));
  });

  it('gives no percentages without a resume', () => {
    expect(checkResume('  ', job)).toMatchObject({ skills: null, keywords: null, score: null });
  });
});

describe('titleMatch', () => {
  it('gives full marks when the whole title appears', () => {
    expect(titleMatch('Frontend Engineer', 'Senior Frontend Engineer at Acme', 'en')).toBe(100);
  });

  it('counts the title’s words otherwise, ignoring gender notes', () => {
    expect(
      titleMatch('Frontend Softwareentwickler (all genders)', 'Frontend developer', 'de'),
    ).toBe(50);
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
    otherSkills: ['Apollo', 'Jest'],
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
    expect(prompt).toContain('Goal: use at least 85%');
    expect(prompt).toContain('Up to three pages');
  });

  it('lets Claude use related terms and the skills on your profile', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain(
      'Other skills I have (not all of them are in my resume):\n- Apollo\n- Jest',
    );
    expect(prompt).toContain('2. Related:');
    expect(prompt).toContain('- Related: the terms you added under rule 2');
    expect(prompt).toContain('- Skipped:');
  });

  it('asks Claude to request the resume when there is none', () => {
    const prompt = buildResumePrompt({
      ...input,
      resume: ' ',
      missingSkills: [],
      otherSkills: [],
      language: null,
    });
    expect(prompt).toContain('Ask me for it before you start');
    expect(prompt).toContain('- (none)');
    expect(prompt).toContain('Write the resume in the language of the job ad');
  });
});
