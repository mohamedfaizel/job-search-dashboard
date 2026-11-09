import { describe, expect, it } from 'vitest';
import { fillEmpty, personalFromResume } from './personal-from-resume';

const PLAIN = `Mohamed Faizel
Data Engineer
Berlin, Germany | +49 176 1234 5678 | mf@example.com | linkedin.com/in/mfaizel | github.com/mfaizel | mfaizel.dev

SUMMARY
Data engineer with 5 years of Python, Node.js and ASP.NET.

EXPERIENCE
Data Engineer | Acme GmbH
01/2021 - 12/2023
- Built ETL pipelines`;

describe('personalFromResume', () => {
  it('reads name, headline, phone and links from the top of a plain resume', () => {
    expect(personalFromResume(PLAIN)).toEqual({
      firstName: 'Mohamed',
      lastName: 'Faizel',
      headline: 'Data Engineer',
      phone: '+49 176 1234 5678',
      linkedinUrl: 'https://linkedin.com/in/mfaizel',
      githubUrl: 'https://github.com/mfaizel',
      websiteUrl: 'https://mfaizel.dev',
    });
  });

  it('keeps https:// links as they are and leaves out what it cannot find', () => {
    const found = personalFromResume(
      '# Ada Lovelace\nSenior Engineer\nada@example.com | https://www.linkedin.com/in/ada/\n\n## Skills\nReact, Node.js',
    );
    expect(found).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      linkedinUrl: 'https://www.linkedin.com/in/ada/',
      githubUrl: '',
      websiteUrl: '',
      phone: '',
    });
  });

  it('does not take dates for a phone number', () => {
    expect(personalFromResume('Ada\nEngineer\n\nWork\n01/2021 - 12/2023\n2019 - 2021').phone).toBe(
      '',
    );
  });

  it('finds nothing in an empty resume', () => {
    expect(Object.values(personalFromResume('')).every((v) => v === '')).toBe(true);
  });
});

describe('fillEmpty', () => {
  it('fills only the empty fields that the resume has', () => {
    const current = {
      firstName: 'Mo',
      lastName: '',
      headline: ' ',
      phone: '',
      linkedinUrl: '',
      githubUrl: 'https://github.com/me',
      websiteUrl: '',
    };
    expect(fillEmpty(current, personalFromResume(PLAIN))).toEqual({
      lastName: 'Faizel',
      headline: 'Data Engineer',
      phone: '+49 176 1234 5678',
      linkedinUrl: 'https://linkedin.com/in/mfaizel',
      websiteUrl: 'https://mfaizel.dev',
    });
  });
});
