import { describe, expect, it } from 'vitest';
import { buildTranslationPrompt, resumeFor } from '../profile/resumes';
import { germanRequirement } from './german';
import { buildInterviewPrompt } from './interview-prompt';
import { parseLine, pdfFileName, textToPdf, toWinAnsi } from './pdf';
import {
  applicationFacts,
  buildResumePrompt,
  buildReviewPrompt,
  splitReply,
  buildQueuePrompt,
  splitQueueReply,
} from './prompt';
import { checkResume, coverage, matchScore, titleMatch } from './score';
import { compact, KNOWN_SKILLS, mentions, relatedTo, spellings } from './skills';
import { buildCorpus, jobTerms } from './terms';
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

  it('treats front-end, front end and frontend as the same skill', () => {
    expect(mentions('Senior Frontend developer', 'front-end')).toBe(true);
    expect(mentions('Senior front-end developer', 'frontend')).toBe(true);
    expect(mentions('Front End engineer', 'frontend')).toBe(true);
    expect(mentions('Built micro-frontends', 'microfrontends')).toBe(true);
    expect(mentions('Shipped an e-commerce site', 'ecommerce')).toBe(true);
    // Short terms only as written: "go" must not match "g-o".
    expect(mentions('g-o', 'go')).toBe(false);
    expect(mentions('frontend', 'backend')).toBe(false);
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

describe('buildInterviewPrompt', () => {
  const input = {
    title: 'Frontend Entwickler',
    company: 'Acme',
    city: 'Berlin',
    resumeLanguage: 'de' as const,
    germanLevel: 'B2',
    languages: ['German A2', 'English C1'],
    missingSkills: ['kafka'],
    missingKeywords: ['microfrontends', 'a', 'b', 'c', 'd', 'e', 'f'],
    mustAdd: [] as string[],
    resumeIn: 'en',
    otherSkills: ['Apollo'],
    resume: 'React developer since 2019.',
    description: 'Wir suchen …',
    facts: [] as string[],
    savedAnswers: '',
    achievements: [] as string[],
    settings: { maxPages: 2, keepSections: false },
  };

  it('coaches in German for a German job, at your real level', () => {
    const prompt = buildInterviewPrompt(input);
    expect(prompt).toContain('Job: Frontend Entwickler at Acme in Berlin');
    expect(prompt).toContain('The job asks for German (B2)');
    expect(prompt).toContain('model answers in German');
    expect(prompt).toContain('- German A2\n- English C1');
    expect(prompt).toContain('never claim a higher one');
  });

  it('lists the gaps, with a few keywords, and keeps your honesty rules', () => {
    const prompt = buildInterviewPrompt(input);
    expect(prompt).toContain('- kafka\n- microfrontends\n- a\n- b\n- c\n- d');
    expect(prompt).not.toContain('- e\n');
    expect(prompt).toContain('Never invent employers, projects, numbers, titles or skills');
    expect(prompt).toContain('React developer since 2019.');
    expect(prompt).toContain('Wir suchen …');
    expect(prompt).toContain('What they care about');
    expect(prompt).toContain('Questions for them');
    expect(prompt).toContain('what to read about Acme');
  });

  it('writes in English for an English job, without a city, resume or description', () => {
    const prompt = buildInterviewPrompt({
      ...input,
      resumeLanguage: 'en',
      germanLevel: null,
      city: null,
      languages: [],
      missingSkills: [],
      missingKeywords: [],
      resume: ' ',
      description: null,
    });
    expect(prompt).toContain('Job: Frontend Entwickler at Acme\n');
    expect(prompt).toContain('Write everything in English.');
    expect(prompt).not.toContain('My languages');
    expect(prompt).toContain('Ask me for it before you start.');
    expect(prompt).toContain('(No description saved.)');
    expect(prompt).toContain('(my likely gaps):\n- (none)');
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
    achievements: ['Cut page load time by 40% at Acme (2023)'],
    settings: { maxPages: 2, keepSections: false },
  };

  it('asks for the job’s language and lists what is missing', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain('Job: Frontend Entwickler at Acme in Berlin');
    expect(prompt).toContain('Write the whole resume in German: the job asks for German (B2).');
    expect(prompt).toContain('- kafka');
    expect(prompt).toContain('- microfrontends');
    expect(prompt).toContain('React developer since 2019.');
    expect(prompt).toContain('Never invent');
    expect(prompt).toContain('Goal: a resume a hiring manager believes');
    expect(prompt).toContain('At most two pages');
    expect(prompt).not.toContain('85%');
  });

  it('reviews its own draft, so one prompt is enough, and only adds skills the ad asks for', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain('review your own draft as the hiring manager');
    expect(prompt).toContain('Reply only with the fixed version');
    expect(prompt).toContain('Only the job ad’s own skills may be added');
    expect(prompt).toContain('Leave out skills from my resume that the ad does not need');
    expect(prompt).toContain('- Changes: what your own review changed');
  });

  it('asks for ATS-safe dates and bans clichés and em dashes', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain('City | MM/YYYY - MM/YYYY');
    expect(prompt).not.toMatch(/MM\/YYYY [–—]/);
    expect(prompt).toContain('a plain hyphen (-) between start and end');
    expect(prompt).toContain('Banned words and phrases: passionate, leverage');
    expect(prompt).toContain('No em dashes');
    expect(prompt).toContain('Interview test:');
    expect(prompt).toContain('- Stretches:');
  });

  it('builds a review prompt that checks the draft against your own resume', () => {
    const prompt = buildReviewPrompt(input, {
      resume: '# Jane\n## Experience\n### Dev | Acme',
      coverLetter: 'Dear team,',
      formAnswers: 'Why Acme: products.',
    });
    expect(prompt).toContain('as the hiring manager for this job would');
    expect(prompt).toContain('Keep everything in German.');
    expect(prompt).toContain('React developer since 2019.');
    expect(prompt).toContain('# Jane');
    expect(prompt).toContain('Dear team,');
    expect(prompt).toContain('Why Acme: products.');
    expect(prompt).toContain('=== RESUME ===');
    expect(prompt).toContain('- Removed:');
    // Its reply goes through the same paste box, so it splits like an Apply kit reply.
    const reply = splitReply(
      '=== RESUME ===\nNew\n=== COVER LETTER ===\nHi\n=== FORM ANSWERS ===\nQ: A\n=== CHECK ===\n- Changes: x',
    );
    expect(reply).toEqual({
      resume: 'New',
      coverLetter: 'Hi',
      formAnswers: 'Q: A',
      check: '- Changes: x',
    });
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
    expect(prompt).toContain('My achievements bank');
    expect(prompt).toContain('Never name the company or say that I am applying');
    expect(prompt).toContain('never write "(fill in)"');
    expect(prompt).toContain('| work permit (only when my application facts give one');
    expect(prompt).toContain('One result per bullet');
    expect(prompt).toContain('At most two pages;');
    expect(prompt).toContain('4 to 5 bullets for my latest job');
    const keep = buildResumePrompt({ ...input, settings: { maxPages: 3, keepSections: true } });
    expect(keep).toContain('At most three pages;');
    expect(keep).toContain('Keep every section of my resume, with my own heading names');
    expect(keep).toContain('Keep every job and project of my resume');
    expect(keep).not.toContain('4 to 5 bullets');
    expect(
      buildResumePrompt({ ...input, settings: { maxPages: 1, keepSections: false } }),
    ).toContain('At most one page;');
    expect(prompt).toContain('- Cut page load time by 40% at Acme (2023)');
    expect(buildResumePrompt({ ...input, achievements: [] })).not.toContain('achievements bank');
    expect(prompt).toContain('- Skipped:');
  });

  it('asks for the job-ad keywords that truly fit, as natural words', () => {
    const prompt = buildResumePrompt(input);
    expect(prompt).toContain(
      'Keywords from the job ad that my resume does not use yet (use the ones that truly fit, as natural words, see rule 3):',
    );
    expect(prompt).toContain("use the ad's exact word where it means the same");
    expect(prompt).toContain('Never use a keyword only to raise a score');
  });

  it('tells Claude the skills you said you have must be in the resume', () => {
    expect(buildResumePrompt(input)).not.toContain('MUST');
    expect(buildResumePrompt({ ...input, mustAdd: ['figma', 'kanban'] })).toContain(
      'say where each went (Replace, Restructure or Add).\n- figma\n- kanban',
    );
    const prompt = buildResumePrompt({ ...input, mustAdd: ['figma'] });
    expect(prompt).toContain('Each MUST be in the new resume at least once');
    expect(prompt).toContain('1. Replace:');
    expect(prompt).toContain('2. Restructure:');
    expect(prompt).toContain('3. Add:');
    expect(prompt).toContain('- Placed: each skill or keyword I confirmed I have');
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
      levelEstimated: false,
    });
  });

  it('finds German skills and their level in an English ad', () => {
    expect(germanRequirement('You speak fluent German (C1) and English.', 'en')).toEqual({
      required: true,
      level: 'C1',
      levelEstimated: false,
    });
    expect(germanRequirement('Requirements:\n- German B2 or better', 'en')).toEqual({
      required: true,
      level: 'B2',
      levelEstimated: false,
    });
    expect(germanRequirement('Sehr gute Deutschkenntnisse (B2) are a must.', 'en')).toEqual({
      required: true,
      level: 'B2',
      levelEstimated: false,
    });
  });

  it('does not need German when it is a plus or not mentioned', () => {
    expect(germanRequirement('German skills are a plus.', 'en').required).toBe(false);
    expect(
      germanRequirement('We are a German company. English is our office language.', 'en'),
    ).toEqual({ required: false, level: null, levelEstimated: false });
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
      check: '- Related: apollo',
    });
  });

  it('keeps a plain resume whole', () => {
    expect(splitReply(' Jane Doe\nReact developer ')).toEqual({
      resume: 'Jane Doe\nReact developer',
      coverLetter: '',
      formAnswers: '',
      check: '',
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
    achievements: [],
    settings: { maxPages: 2, keepSections: false },
  });

  it('puts the resume in once and each job with its own language and markers', () => {
    const prompt = buildQueuePrompt([job('a', 'Backend'), job('b', 'Frontend', 'de')]);
    expect(prompt.split('My resume.')).toHaveLength(2);
    expect(prompt).toContain('--- JOB 2 of 2: Frontend at Acme (id b) ---');
    expect(prompt).toContain('in German: it asks for German (C1)');
    expect(prompt).toContain('=== JOB 1: a ===');
    // "I have this" skills go with their own job.
    expect(prompt.split('MUST')).toHaveLength(2);
    expect(prompt).toContain('(Replace, Restructure or Add).\n- figma');
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

describe('jobTerms', () => {
  it('counts front-end and frontend once, and not again as a keyword when it is a skill', () => {
    const job = {
      title: 'Frontend Engineer',
      description:
        'We build front-end apps. Our frontend team loves front-end testing and accessibility. Accessibility matters.',
      language: 'en',
      skills: ['Frontend', 'front-end', 'React'],
      city: null,
      raw: null,
      company: { name: 'Acme' },
    };
    const terms = jobTerms(job, new Set(), buildCorpus([job]));
    expect(terms.skills).toEqual(['frontend', 'react']);
    expect(terms.keywords.map(compact)).not.toContain('frontend');
    expect(terms.keywords).toContain('accessibility');
  });
});

describe('jobTerms keywords', () => {
  const ad = `Build intuitive UIs from Figma mocks. Optimize performance, focusing on Core Web Vitals.
Define React Query caching, retries, and optimistic updates. Build a component library with Storybook.
Break fuzzy ideas into clear specs. Represent engineering in roadmap; balance value, effort, and risk.
Rapid-prototype UI to de-risk big bets. Strong knowledge of TypeScript, React, and React Native.
Experience creating websites from Figma mocks. Experience with testing frameworks (Jest, Detox, etc.).`;
  const job = {
    title: 'Senior Frontend Engineer',
    description: ad,
    language: 'en',
    skills: ['react', 'typescript'],
    city: null,
    raw: null,
    company: { name: 'Matchmatch' },
  };

  it('finds the ad’s real phrases and tools, not single plain words', () => {
    const { keywords } = jobTerms(job, new Set(), buildCorpus([job]));
    expect(keywords).toEqual(
      expect.arrayContaining([
        'core web vitals',
        'react query',
        'optimistic updates',
        'component library',
        'storybook',
        'react native',
        'detox',
        'figma mocks',
        'testing frameworks',
      ]),
    );
    for (const noise of ['fuzzy', 'bets', 'represent', 'mocks', 'figma'])
      expect(keywords).not.toContain(noise);
    expect(keywords.length).toBeLessThanOrEqual(12);
  });

  it('leaves out a phrase you removed', () => {
    const { keywords } = jobTerms(job, new Set(['detox']), buildCorpus([job]));
    expect(keywords).not.toContain('detox');
  });
});

describe('germanRequirement levels', () => {
  const level = (ad: string) => {
    const g = germanRequirement(ad, 'en');
    return [g.level, g.levelEstimated];
  };
  it('uses the level the ad names', () => {
    expect(level('You speak German at B2 level.')).toEqual(['B2', false]);
  });
  it('estimates the level from how the ad describes it', () => {
    expect(level('Fluent German is required.')).toEqual(['C1', true]);
    expect(level('Verhandlungssichere Deutschkenntnisse.')).toEqual(['C1', true]);
    expect(level('Sehr gute Deutschkenntnisse in Wort und Schrift.')).toEqual(['C1', true]);
    expect(level('Gute Deutschkenntnisse.')).toEqual(['B2', true]);
    expect(level('Deutschkenntnisse: Grundkenntnisse.')).toEqual(['A2', true]);
    expect(level('Native German speaker.')).toEqual(['C2', true]);
  });
  it('says nothing about the level when the ad says nothing', () => {
    expect(germanRequirement('Wir suchen eine Entwicklerin.', 'de')).toEqual({
      required: true,
      level: null,
      levelEstimated: false,
    });
  });
});
