import { describe, expect, it } from 'vitest';
import { buildTranslationPrompt, resumeFor } from '../profile/resumes';
import { germanRequirement } from './german';
import { parseLine, pdfFileName, textToPdf, toWinAnsi } from './pdf';
import {
  applicationFacts,
  buildResumePrompt,
  splitReply,
  buildQueuePrompt,
  splitQueueReply,
} from './prompt';
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

  it('drops German ad boilerplate like "Arbeitsort" and "Ballungsräumen"', () => {
    expect(
      tokenize(
        'Arbeitsort Hamburg. Bedarfsverkehre und Bedienformen in Ballungsräumen: Ihr Beitrag mit Figma',
        stopwordsFor('de'),
      ),
    ).toEqual(['figma']);
  });
});

describe('keywordTokens', () => {
  it('keeps only nouns and tech words in German, without gender endings', () => {
    expect(
      keywordTokens('Du bietest Erfahrung mit Kafka, c++ und arbeitest mit Entwickler*innen', 'de'),
    ).toEqual(['kafka', 'c++', 'entwickler']);
  });

  it('drops ad boilerplate, language levels and the recruiter’s name', () => {
    expect(
      keywordTokens(
        'Ort: Berlin. Anstellungsart: Festanstellung. Deutsch auf C1-Niveau, Englisch B2. Kafka. Ihr Ansprechpartner Andreas',
        'de',
      ),
    ).toEqual(['deutsch', 'englisch', 'kafka']);
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
    // A title alone says too little: an ad without a description gets no score.
    expect(matchScore({ keywords: null, skills: null, title: 100 })).toBeNull();
  });

  it('turns found terms into a percent', () => {
    expect(
      coverage([
        { term: 'a', inResume: true, youHave: false, relatedTo: null },
        { term: 'b', inResume: false, youHave: false, relatedTo: null },
        { term: 'c', inResume: false, youHave: false, relatedTo: null },
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
      { term: 'kafka', inResume: true, youHave: false, relatedTo: null },
      { term: 'react', inResume: false, youHave: false, relatedTo: null },
    ]);
    expect(check).toMatchObject({ skills: 50, keywords: 100, title: 100 });
    expect(check.score).toBe(matchScore({ skills: 50, keywords: 100, title: 100 }));
  });

  it('counts a skill you said you have ("I have this") as covered', () => {
    const check = checkResume('Backend Engineer: Kafka and microservices', job, ['React', 'Figma']);
    expect(check.skillChecks[1]).toEqual({
      term: 'react',
      inResume: false,
      youHave: true,
      relatedTo: null,
    });
    expect(check).toMatchObject({ skills: 100, score: 100 });
    // Already in the resume: it is "in your resume", not "you have it".
    expect(checkResume('Kafka', job, ['Kafka']).skillChecks[0]).toMatchObject({
      inResume: true,
      youHave: false,
    });
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
    resumeLanguage: 'de' as const,
    germanLevel: 'B2',
    languages: ['German A2', 'English C1'],
    missingSkills: ['kafka'],
    missingKeywords: ['microfrontends'],
    mustAdd: [] as string[],
    resumeIn: 'en',
    otherSkills: ['Apollo', 'Jest'],
    resume: 'React developer since 2019.',
    description: 'Wir suchen …',
    facts: ['Work permit: EU Blue Card', 'Notice period / earliest start: 1 month'],
    savedAnswers: 'I want to work on products people use every day.',
  };

  it('asks for the job’s language and lists what is missing', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain('Job: Frontend Entwickler at Acme in Berlin');
    expect(prompt).toContain('Write the whole resume in German: the job asks for German (B2).');
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
  });

  it('asks for a cover letter and form answers from your real facts, in marked parts', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain('Then write, in German:');
    expect(prompt).toContain(
      'A cover letter for this job: 200 to 300 words, to the hiring team at Acme',
    );
    expect(prompt).toContain(
      '- Work permit: EU Blue Card\n- Notice period / earliest start: 1 month',
    );
    expect(prompt).toContain('I want to work on products people use every day.');
    for (const part of ['RESUME', 'COVER LETTER', 'FORM ANSWERS', 'CHECK']) {
      expect(prompt).toContain(`=== ${part} ===`);
    }
    expect(buildResumePrompt({ ...input, savedAnswers: ' ' })).not.toContain('My saved answers');
    expect(prompt).toContain('- Skipped:');
  });

  it('asks for as many job-ad keywords as possible, as natural words', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain(
      'Keywords from the job ad that my resume does not use yet (use as many as you honestly can, as natural words, see rule 3):',
    );
    expect(prompt).toContain("in the ad's exact wording");
    expect(prompt).toContain('Never stuff them into a list');
  });

  it('tells Claude the skills you said you have must be in the resume', () => {
    expect(buildResumePrompt(input)).not.toContain('MUST');
    expect(buildResumePrompt({ ...input, mustAdd: ['figma', 'kanban'] })).toContain(
      'They MUST be in the new resume: in the Skills section, and next to the experience where I used them when that is clear from my resume:\n- figma\n- kanban',
    );
  });

  it('starts from your German resume when you have one', () => {
    expect(buildResumePrompt({ ...input, resumeIn: 'de' })).toContain(
      'My resume below is already in German: keep its wording',
    );
    expect(buildResumePrompt(input)).toContain('Translate my resume');
    expect(
      buildResumePrompt({ ...input, resumeLanguage: 'en', germanLevel: null, resumeIn: 'de' }),
    ).toContain('My resume below is in German: translate it.');
  });

  it('keeps your real language levels', () => {
    expect(buildResumePrompt(input)).toContain(
      'exactly like this, never higher:\n- German A2\n- English C1',
    );
    expect(buildResumePrompt({ ...input, languages: [] })).toContain('Never raise them.');
  });

  it('asks for an English resume when the job does not need German', () => {
    const prompt = buildResumePrompt({ ...input, resumeLanguage: 'en', germanLevel: null });
    expect(prompt).toContain("Write the resume in English: the job doesn't ask for German.");
    expect(prompt).not.toContain('Write the whole resume in German');
  });

  it('asks Claude to request the resume when there is none', () => {
    const prompt = buildResumePrompt({
      ...input,
      resume: ' ',
      missingSkills: [],
      otherSkills: [],
    });
    expect(prompt).toContain('Ask me for it before you start');
    expect(prompt).toContain('- (none)');
  });
});

describe('germanRequirement', () => {
  it('needs German when the ad is written in German', () => {
    expect(germanRequirement('Wir suchen einen Entwickler.', 'de')).toEqual({
      required: true,
      level: null,
    });
  });

  it('finds German skills and their level in an English ad', () => {
    expect(germanRequirement('You speak fluent German (C1) and English.', 'en')).toEqual({
      required: true,
      level: 'C1',
    });
    expect(germanRequirement('Requirements:\n- German B2 or better', 'en')).toEqual({
      required: true,
      level: 'B2',
    });
    expect(germanRequirement('Sehr gute Deutschkenntnisse (B2) are a must.', 'en')).toEqual({
      required: true,
      level: 'B2',
    });
  });

  it('does not need German when it is a plus or not mentioned', () => {
    expect(germanRequirement('German skills are a plus.', 'en').required).toBe(false);
    expect(
      germanRequirement('We are a German company. English is our office language.', 'en'),
    ).toEqual({ required: false, level: null });
    expect(germanRequirement(null, null).required).toBe(false);
  });
});

describe('splitReply', () => {
  it('splits the Apply kit reply at its marker lines, even in Markdown', () => {
    const reply = `Here you go.
=== RESUME ===
Jane Doe
React developer
**=== COVER LETTER ===**
Dear hiring team,
## === FORM ANSWERS ===
Notice period: 1 month
=== CHECK ===
- Related: apollo`;
    expect(splitReply(reply)).toEqual({
      resume: 'Jane Doe\nReact developer',
      coverLetter: 'Dear hiring team,',
      formAnswers: 'Notice period: 1 month',
    });
  });

  it('keeps a plain resume whole', () => {
    expect(splitReply(' Jane Doe\nReact developer ')).toEqual({
      resume: 'Jane Doe\nReact developer',
      coverLetter: '',
      formAnswers: '',
    });
  });
});

describe('applicationFacts', () => {
  it('lists only the answers you gave', () => {
    expect(
      applicationFacts({
        address: 'Berlin, Germany',
        workPermit: '',
        noticePeriod: '1 month',
        salaryExpectation: ' ',
        relocation: '',
        yearsExperience: 6,
      }),
    ).toEqual([
      'Location: Berlin, Germany',
      'Years of experience: 6',
      'Notice period / earliest start: 1 month',
    ]);
    expect(applicationFacts(null)).toEqual([]);
  });
});

describe('resume PDF', () => {
  it('names the file after you and the company', () => {
    expect(pdfFileName('Mohamed Faizel', 'Resume', 'Computer Futures GmbH')).toBe(
      'Mohamed-Faizel-Resume-ComputerFutures.pdf',
    );
    expect(pdfFileName(null, 'Cover-letter', 'Acme')).toBe('Cover-letter-Acme.pdf');
  });

  it('reads Markdown headings, bold headings and bullets', () => {
    expect(parseLine('# Mohamed Faizel', true)).toEqual({
      style: 'name',
      text: 'Mohamed Faizel',
      bullet: false,
    });
    expect(parseLine('## Berufserfahrung', false).style).toBe('heading');
    expect(parseLine('**SKILLS**', false)).toEqual({
      style: 'heading',
      text: 'SKILLS',
      bullet: false,
    });
    expect(parseLine('- Built **React** apps', false)).toEqual({
      style: 'body',
      text: 'Built React apps',
      bullet: true,
    });
  });

  it('keeps German letters and swaps what the PDF font lacks', () => {
    expect(toWinAnsi('Größe – „gut“ → ok ✓')).toBe('Größe - "gut" -> ok ');
  });

  it('makes a PDF, also for a long resume', async () => {
    const bytes = await textToPdf(`# Ada\n${'- Line of work\n'.repeat(200)}`, 'Ada');
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('queue prompt', () => {
  const job = (jobId: string, title: string, resumeLanguage: 'de' | 'en' = 'en') => ({
    jobId,
    title,
    company: 'Acme',
    city: null,
    resumeLanguage,
    germanLevel: resumeLanguage === 'de' ? 'C1' : null,
    languages: ['German A2'],
    missingSkills: ['kafka'],
    missingKeywords: [],
    mustAdd: jobId === 'a' ? ['figma'] : [],
    resumeIn: 'en',
    otherSkills: [],
    resume: 'My resume.',
    description: 'x'.repeat(6000),
    facts: [],
    savedAnswers: '',
  });

  it('puts the resume in once and each job with its own language and markers', () => {
    const prompt = buildQueuePrompt([job('a', 'Backend'), job('b', 'Frontend', 'de')]);
    expect(prompt.split('My resume.')).toHaveLength(2);
    expect(prompt).toContain('--- JOB 2 of 2: Frontend at Acme (id b) ---');
    expect(prompt).toContain('in German: it asks for German (C1)');
    expect(prompt).toContain('=== JOB 1: a ===');
    // "I have this" skills go with their own job.
    expect(prompt.split('MUST')).toHaveLength(2);
    expect(prompt).toContain('when that is clear from my resume:\n- figma');
    // Long ads are cut, so five jobs fit.
    expect(prompt).toContain(`${'x'.repeat(5000)} […]`);
    expect(buildQueuePrompt([])).toBe('');
  });

  it('puts each master resume in once when jobs start from different ones', () => {
    const german = { ...job('b', 'Frontend', 'de'), resumeIn: 'de', resume: 'Mein Lebenslauf.' };
    const prompt = buildQueuePrompt([job('a', 'Backend'), german]);
    expect(prompt).toContain('My current resume in English:\n"""\nMy resume.');
    expect(prompt).toContain('My current resume in German:\n"""\nMein Lebenslauf.');
    expect(prompt).toContain('Start from my resume in German.');
    expect(buildQueuePrompt([job('a', 'Backend')])).not.toContain('Start from');
  });

  it('splits a reply by job id, or by number when the id is garbled', () => {
    const replies = splitQueueReply(
      'Intro\n=== JOB 1: a ===\nfirst\n## === JOB 2: zzz ===\nsecond\n=== JOB 3: c ===\n',
      ['a', 'b', 'c'],
    );
    expect([...replies]).toEqual([
      ['a', 'first'],
      ['b', 'second'],
    ]);
  });
});

describe('master resumes in more languages', () => {
  const resumes = { language: 'en', text: 'English CV', others: new Map([['de', 'Deutscher CV']]) };

  it('picks the resume in the job’s language, else the main one', () => {
    expect(resumeFor(resumes, 'de')).toEqual({ text: 'Deutscher CV', language: 'de' });
    expect(resumeFor(resumes, 'en')).toEqual({ text: 'English CV', language: 'en' });
    expect(resumeFor(resumes, 'fr')).toEqual({ text: 'English CV', language: 'en' });
    expect(resumeFor(resumes, null)).toEqual({ text: 'English CV', language: 'en' });
  });

  it('asks Claude to translate without changing facts or language levels', () => {
    const prompt = buildTranslationPrompt({
      resume: 'Frontend Engineer at Acme, 2019-2024.',
      from: 'en',
      to: 'de',
      languages: ['German A2', 'English C1'],
    });
    expect(prompt).toContain('translate my resume from English into German');
    expect(prompt).toContain('Keep every employer, job title, date');
    expect(prompt).toContain('Berufserfahrung');
    expect(prompt).toContain('never higher:\n- German A2\n- English C1');
    expect(prompt).toContain('Frontend Engineer at Acme, 2019-2024.');
  });
});
