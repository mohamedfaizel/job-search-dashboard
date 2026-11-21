import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../../profile/test/render';
import { api, MATCHER_RESUME, ME, RM_RUNNING, server, syncs } from '../../profile/test/server';
import { ResumeMatcherStatus } from './ResumeMatcherStatus';

describe('ResumeMatcherStatus', () => {
  it('shows that it is running and tests the AI connection on request', async () => {
    const user = userEvent.setup();
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Resume-Matcher is running.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Test AI connection' }));

    expect(
      await screen.findByText('Resume-Matcher is running and Claude answered.'),
    ).toBeInTheDocument();
  });

  it('tells a normal user only that it is not available', async () => {
    downWith('Resume-Matcher is not available right now. Please try again later.');
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('Not available')).toBeInTheDocument();
    expect(screen.queryByText(/rm:up/)).toBeNull();
    // Testing the AI is pointless until the container runs.
    expect(screen.queryByRole('button', { name: 'Test AI connection' })).toBeNull();
  });

  it('tells an admin how to start it', async () => {
    downWith(
      'Resume-Matcher at http://localhost:3100 is not reachable. Start it with pnpm rm:up.',
      'Resume-Matcher at http://localhost:3100 is not reachable',
    );
    server.use(
      api.query('Me', () => HttpResponse.json({ data: { me: { ...ME, role: 'ADMIN' } } })),
    );
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('Not running')).toBeInTheDocument();
    expect(
      screen.getByText("Resume-Matcher doesn't answer. Start it with pnpm rm:up."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Details: .*localhost:3100/)).toBeInTheDocument();
  });

  it('speaks German, though the server sends English', async () => {
    const user = userEvent.setup();
    renderWithData(<ResumeMatcherStatus />, 'de');

    expect(await screen.findByText('Läuft')).toBeInTheDocument();
    expect(screen.getByText('Resume-Matcher läuft.')).toBeInTheDocument();
    expect(
      await screen.findByText('Dein Lebenslauf wurde noch nicht an Resume-Matcher gesendet.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'KI-Verbindung testen' }));

    expect(
      await screen.findByText('Resume-Matcher läuft und Claude hat geantwortet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/answered|running/)).toBeNull();
  });

  it('keeps the AI error as a detail under the translated sentence', async () => {
    const user = userEvent.setup();
    server.use(
      api.query('ResumeMatcherStatus', ({ variables }) =>
        HttpResponse.json({
          data: {
            resumeMatcherStatus: variables['checkAi']
              ? { ...RM_RUNNING, message: '401 invalid x-api-key', error: '401 invalid x-api-key' }
              : RM_RUNNING,
          },
        }),
      ),
    );
    renderWithData(<ResumeMatcherStatus />, 'de');

    await user.click(await screen.findByRole('button', { name: 'KI-Verbindung testen' }));

    expect(await screen.findByText('Der KI-Test hat nicht geklappt.')).toBeInTheDocument();
    expect(screen.getByText('Details: 401 invalid x-api-key')).toBeInTheDocument();
  });
});

/** Resume-Matcher is down, and the API says so with this message (and error, for admins). */
function downWith(message: string, error: string | null = null) {
  server.use(
    api.query('ResumeMatcherStatus', () =>
      HttpResponse.json({
        data: { resumeMatcherStatus: { ...RM_RUNNING, reachable: false, message, error } },
      }),
    ),
  );
}

describe('your resume in Resume-Matcher', () => {
  it('sends the resume on request and shows it is ready', async () => {
    const user = userEvent.setup();
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('Not sent')).toBeInTheDocument();
    expect(
      screen.getByText("Your resume hasn't been sent to Resume-Matcher yet."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send resume' }));

    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(
      screen.getByText('Resume-Matcher has read ada.pdf. Jobs will be matched against it.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send again' })).toBeInTheDocument();
    expect(syncs).toHaveLength(1);
  });

  it('asks for a file first when none was uploaded', async () => {
    server.use(
      api.query('MyMatcherResume', () =>
        HttpResponse.json({
          data: {
            myMatcherResume: {
              ...MATCHER_RESUME,
              state: 'NO_FILE',
              message: 'Upload your resume as a PDF or Word file on this page.',
            },
          },
        }),
      ),
    );
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('No file yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send/ })).toBeNull();
  });
});
