import { followUpEmail } from './followUpEmail';
import { JOBS } from './test/fixtures';

const job = JOBS[0]!;
const app = { updatedAt: '2026-10-26T09:00:00.000Z' };

describe('followUpEmail', () => {
  it('writes English for an English ad, signed with your name', () => {
    const text = followUpEmail({ ...app, job: { ...job, language: 'en' } }, 'Mo Abdullah');
    expect(text).toContain(`Subject: Following up on my application: ${job.title}`);
    expect(text).toContain(`at ${job.company.name} on 26 October 2026`);
    expect(text.endsWith('Mo Abdullah')).toBe(true);
  });

  it('writes German for a German ad', () => {
    const text = followUpEmail({ ...app, job: { ...job, language: 'de' } }, 'Mo Abdullah');
    expect(text).toContain('Sehr geehrte Damen und Herren');
    expect(text).toContain('am 26. Oktober 2026');
  });

  it('leaves a placeholder when your name is not on your profile', () => {
    expect(followUpEmail({ ...app, job: { ...job, language: 'en' } }, ' ')).toContain(
      '[Your name]',
    );
    expect(followUpEmail({ ...app, job: { ...job, language: 'de' } }, '')).toContain('[Ihr Name]');
  });
});
