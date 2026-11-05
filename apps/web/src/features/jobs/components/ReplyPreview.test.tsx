import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { makeJob } from '../test/fixtures';
import { jobResume, requests, SAVED_RESUME } from '../test/server';
import { ApplyKitPanel } from './ApplyKitPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <ApplyKitPanel
          job={makeJob()}
          onStatusChange={() => undefined}
          asking={false}
          onApplyStarted={() => undefined}
          onAnswered={() => undefined}
        />
      </DataProvider>
    </Intl>,
  );
}

const preview = () => screen.findByRole('region', { name: 'Preview and edit' });

describe('ReplyPreview', () => {
  beforeEach(() => {
    jobResume.current = SAVED_RESUME;
  });

  it('shows the saved resume like a page, without Markdown marks', async () => {
    renderPanel();
    const page = within(await preview()).getByRole('group', { name: 'Resume' });
    expect(within(page).getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(within(page).getByRole('button', { name: 'Experience' })).toBeInTheDocument();
    expect(
      within(page).getByRole('button', { name: /Built dashboards in React and GraphQL/ }),
    ).toBeInTheDocument();
    expect(page).not.toHaveTextContent('##');
  });

  it('changes a line in place, adds one below, undoes, resets and saves', async () => {
    const user = userEvent.setup();
    renderPanel();
    const box = await preview();
    const save = within(box).getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();

    await user.click(within(box).getByRole('button', { name: /Built dashboards/ }));
    const line = within(box).getByRole('textbox', { name: 'Edit this line' });
    expect(line).toHaveValue('Built dashboards in React and GraphQL');
    await user.clear(line);
    await user.type(line, 'Built 3 dashboards in React{Enter}');
    expect(within(box).getByText('Unsaved changes')).toBeInTheDocument();
    expect(
      within(box).getByRole('button', { name: /Built 3 dashboards in React/ }),
    ).toBeInTheDocument();

    // + Line below starts a new bullet under it.
    await user.click(within(box).getByRole('button', { name: /Built 3 dashboards/ }));
    await user.click(within(box).getByRole('button', { name: '+ Line below' }));
    await user.type(
      within(box).getByRole('textbox', { name: 'Edit this line' }),
      'Cut load time by half{Enter}',
    );

    await user.click(within(box).getByRole('button', { name: 'Undo' }));
    await user.click(within(box).getByRole('button', { name: 'Undo' }));
    expect(within(box).queryByRole('button', { name: /Cut load time/ })).toBeNull();
    await user.click(within(box).getByRole('button', { name: 'Reset' }));
    expect(within(box).queryByText('Unsaved changes')).toBeNull();
    // Reset can be undone too.
    await user.click(within(box).getByRole('button', { name: 'Undo' }));
    await user.click(within(box).getByRole('button', { name: /Built 3 dashboards/ }));
    await user.click(within(box).getByRole('button', { name: '+ Line below' }));
    await user.type(
      within(box).getByRole('textbox', { name: 'Edit this line' }),
      'Cut load time by half{Enter}',
    );
    await user.click(save);

    const sent = requests.find((r) => r.operation === 'EditJobResume');
    expect(sent?.variables).toMatchObject({
      jobId: 'job-1',
      coverLetter: SAVED_RESUME.coverLetter,
      formAnswers: SAVED_RESUME.formAnswers,
    });
    expect(sent?.variables['resume']).toContain(
      '- Built 3 dashboards in React\n- Cut load time by half\n',
    );
    // The new save starts a fresh draft.
    expect(
      await within(await preview()).findByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();
  });

  it('edits the cover letter as text', async () => {
    const user = userEvent.setup();
    renderPanel();
    const box = await preview();
    await user.click(within(box).getByRole('tab', { name: 'Cover letter' }));
    await user.click(within(box).getByRole('button', { name: 'Edit as text' }));
    const text = within(box).getByRole('textbox', { name: 'Cover letter text' });
    await user.type(text, ' Thanks!');
    await user.click(within(box).getByRole('button', { name: 'Save changes' }));

    expect(requests).toContainEqual(
      expect.objectContaining({
        operation: 'EditJobResume',
        variables: expect.objectContaining({
          coverLetter: `${SAVED_RESUME.coverLetter} Thanks!`,
        }) as object,
      }),
    );
  });
});
