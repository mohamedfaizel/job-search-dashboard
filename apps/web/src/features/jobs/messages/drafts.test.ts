import { CONNECT_LIMIT, listWords, messagesPrompt, recruiterDrafts } from './drafts';

const base = {
  language: 'en',
  firstName: 'Ada',
  fullName: 'Ada Lovelace',
  headline: 'Analytics Engineer',
  yearsExperience: 4,
  skills: ['SQL', 'dbt', 'Power BI', 'Python'],
  achievement: 'Cut the nightly load from 4 hours to 40 minutes.',
  title: 'Data Analyst (m/w/d)',
  company: 'Acme',
  recipient: '',
};

describe('listWords', () => {
  it('joins with commas and "and"', () => {
    expect(listWords([], 'en')).toBe('');
    expect(listWords(['A'], 'en')).toBe('A');
    expect(listWords(['A', 'B', 'C'], 'en')).toBe('A, B and C');
    expect(listWords(['A', 'B'], 'de')).toBe('A und B');
  });
});

describe('recruiterDrafts', () => {
  it('writes English drafts from your facts', () => {
    const d = recruiterDrafts({ ...base, recipient: 'Anna' });
    expect(d.connect).toBe(
      "Hi Anna, I'm Ada, an Analytics Engineer with 4 years of experience in SQL and dbt. I just saw the Data Analyst role at Acme and would love to connect and learn more about the team. Thank you!",
    );
    expect(d.recruiter).toContain('Hello Anna,');
    expect(d.recruiter).toContain('working with SQL, dbt and Power BI.');
    expect(d.recruiter).toContain(
      "One result I'm proud of: Cut the nightly load from 4 hours to 40 minutes.",
    );
    expect(d.recruiter).toMatch(/Best regards,\nAda Lovelace$/);
    expect(d.thanks).toMatch(/^Hello Anna,/);
  });

  it('copes with an empty profile', () => {
    const d = recruiterDrafts({
      ...base,
      firstName: '',
      fullName: '',
      headline: '',
      yearsExperience: null,
      skills: [],
      achievement: '',
    });
    expect(d.connect).toBe(
      "Hi, I'm someone. I just saw the Data Analyst role at Acme and would love to connect and learn more about the team. Thank you!",
    );
    expect(d.recruiter).toMatch(/^Dear hiring team,/);
    expect(d.recruiter).toMatch(/Best regards,$/);
  });

  it('keeps the LinkedIn note within the limit', () => {
    const long = recruiterDrafts({ ...base, headline: 'Data person '.repeat(20).trim() });
    expect(long.connect.length).toBeLessThanOrEqual(CONNECT_LIMIT);
    expect(long.connect).toBe(
      'Hi, I saw the Data Analyst role at Acme and would love to connect. Thank you!',
    );
  });

  it('writes German drafts in the "Sie" form', () => {
    const d = recruiterDrafts({ ...base, language: 'de' });
    expect(d.connect).toContain(
      'Hallo, ich bin Ada, Analytics Engineer mit 4 Jahren Erfahrung in SQL und dbt.',
    );
    expect(d.recruiter).toMatch(/^Sehr geehrte Damen und Herren,/);
    expect(d.recruiter).toContain(
      'Ich bringe 4 Jahre Erfahrung als Analytics Engineer mit, unter anderem mit SQL, dbt und Power BI.',
    );
    expect(d.thanks).toContain('vielen Dank für das Gespräch');
    const noYears = recruiterDrafts({
      ...base,
      language: 'de',
      yearsExperience: null,
      headline: '',
      recipient: 'Frau Schmidt',
    });
    expect(noYears.recruiter).toMatch(/^Guten Tag Frau Schmidt,/);
    expect(noYears.recruiter).toContain('Ich arbeite als Fachkraft');
  });
});

describe('messagesPrompt', () => {
  it('lists only your facts and asks for four messages', () => {
    const prompt = messagesPrompt({ ...base, achievements: ['A', 'B'] });
    expect(prompt).toContain('Job: Data Analyst at Acme');
    expect(prompt).toContain("I don't know the recruiter's name yet.");
    expect(prompt).toContain('- Achievement: B');
    expect(prompt).toContain('## 4. Follow-up after a week without news');
    const de = messagesPrompt({
      ...base,
      language: 'de',
      recipient: 'Anna',
      fullName: '',
      headline: '',
      yearsExperience: null,
      skills: [],
      achievements: [],
    });
    expect(de).toContain('I am writing to Anna.');
    expect(de).toContain('polite German');
    expect(de).toContain('(nothing saved yet');
  });
});
