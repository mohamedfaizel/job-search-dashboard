import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from '../../test/navigation';
import { renderWithData } from '../profile/test/render';
import { apiKeys, poolKey, requests } from '../profile/test/server';
import { WelcomePage } from './WelcomePage';

const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

async function renderWelcome(locale: 'en' | 'de' = 'en') {
  const user = userEvent.setup();
  renderWithData(<WelcomePage />, locale);
  await screen.findByRole('heading', { level: 1 });
  return user;
}

describe('Welcome steps', () => {
  beforeEach(() => {
    apiKeys.length = 0;
    Object.assign(poolKey, { state: 'NONE', requestedAt: null, used: 0 });
    localStorage.clear();
  });

  it('asks for the job data key, then the resume, and fills My profile from it', async () => {
    const user = await renderWelcome();
    expect(
      await screen.findByRole('heading', { name: 'Welcome, Ada King Lovelace!' }),
    ).toBeInTheDocument();
    const steps = screen.getByRole('navigation', { name: 'Steps' });
    expect(within(steps).getByRole('button', { name: 'Job data key' })).toHaveAttribute(
      'aria-current',
      'step',
    );

    // Says where a new user gets their own token.
    expect(screen.getByRole('link', { name: 'Get your token here' })).toHaveAttribute(
      'href',
      'https://jobspipe.dev',
    );
    await user.type(await screen.findByLabelText('JobHunter token'), 'jh_live_1234');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.queryByText(/1234/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next ›' }));

    // Step 2: the AI key, without the Resume-Matcher status of Settings.
    expect(screen.getByRole('heading', { name: '2. Your AI key (optional)' })).toBeInTheDocument();
    await user.type(await screen.findByLabelText('Claude API key'), 'sk-ant-1234');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next ›' }));

    expect(screen.getByRole('heading', { name: '3. Your resume' })).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Upload a PDF or Word file'), pdf('cv.pdf'));
    const filled = await screen.findByText('Added to My profile › Personal:');
    expect(filled.parentElement).toHaveTextContent('Headline');
    await user.click(screen.getByRole('button', { name: 'Next ›' }));

    expect(screen.getByText('Job data key saved')).toBeInTheDocument();
    expect(screen.getByText('AI key saved')).toBeInTheDocument();
    expect(screen.getByText('Resume uploaded')).toBeInTheDocument();
    // What to try next, the same tiles as What's new on My Jobs.
    expect(screen.getByRole('heading', { name: "What's next" })).toBeInTheDocument();
    expect(screen.getByText(/turn on Autopilot/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find my first jobs ›' }));
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/jobs/add');
    });
    expect(requests.map((r) => r.operation)).toEqual([
      'SaveApiKey',
      'SaveApiKey',
      'UploadResume',
      'FinishOnboarding',
    ]);
    // Finishing counts as having seen What's new.
    expect(localStorage.getItem('jsh.whatsNew.2026-11')).toBe('1');
  });

  it('lets you skip each step, and says what is still missing', async () => {
    const user = await renderWelcome();
    await user.click(await screen.findByRole('button', { name: 'Skip for now ›' }));
    // A skipped step gets no ✓.
    expect(screen.getByRole('button', { name: 'Job data key' })).not.toHaveTextContent('✓');
    await user.click(screen.getByRole('button', { name: '‹ Back' }));
    expect(screen.getByRole('heading', { name: '1. Your job data key' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for now ›' }));
    await user.click(screen.getByRole('button', { name: 'Skip for now ›' }));
    // A resume uploaded before (on My profile) counts.
    await user.click(screen.getByRole('button', { name: 'Next ›' }));
    expect(screen.getByText(/No job data key yet/)).toBeInTheDocument();
    expect(screen.getByText(/No AI key yet/)).toBeInTheDocument();
    expect(screen.getByText('Resume uploaded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check My profile' }));
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/profile');
    });
  });

  it('shows the key a new account got from the pool, and counts it as done', async () => {
    Object.assign(poolKey, { state: 'APPROVED', used: 0, limit: 500 });
    const user = await renderWelcome();
    expect(await screen.findByText(/Already set, nothing to do/)).toBeInTheDocument();
    // Your own token is still possible, folded away.
    expect(screen.getByText('Your own JobHunter token (optional)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Job data key set (from the pool, 500 credits)')).toBeInTheDocument();
    expect(screen.queryByText(/No job data key yet/)).not.toBeInTheDocument();
    // A tile link finishes the setup first, then goes there.
    await user.click(screen.getByRole('button', { name: 'Autopilot' }));
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/jobs/add');
    });
  });

  it('skips the whole setup in one click, in German too', async () => {
    const user = await renderWelcome('de');
    await user.click(screen.getByRole('button', { name: 'Einrichtung überspringen' }));
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/jobs');
    });
    expect(requests).toEqual([{ operation: 'FinishOnboarding', variables: {} }]);
  });
});
