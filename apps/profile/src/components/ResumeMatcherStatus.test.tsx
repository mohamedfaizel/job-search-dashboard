import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../test/render';
import { api, RM_RUNNING, server } from '../test/server';
import { ResumeMatcherStatus } from './ResumeMatcherStatus';

describe('ResumeMatcherStatus', () => {
  it('shows that it is running and tests the AI connection on request', async () => {
    const user = userEvent.setup();
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Resume-Matcher is running.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Test AI connection' }));

    expect(
      await screen.findByText('Resume-Matcher is running and the AI provider answered.'),
    ).toBeInTheDocument();
  });

  it('says how to start it when it is not running', async () => {
    server.use(
      api.query('ResumeMatcherStatus', () =>
        HttpResponse.json({
          data: {
            resumeMatcherStatus: {
              ...RM_RUNNING,
              reachable: false,
              message:
                'Resume-Matcher at http://localhost:3100 is not reachable. Start it with pnpm rm:up.',
            },
          },
        }),
      ),
    );
    renderWithData(<ResumeMatcherStatus />);

    expect(await screen.findByText('Not running')).toBeInTheDocument();
    expect(screen.getByText(/Start it with pnpm rm:up/)).toBeInTheDocument();
    // Testing the AI is pointless until the container runs.
    expect(screen.queryByRole('button', { name: 'Test AI connection' })).toBeNull();
  });
});
