import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { makeJob } from '../test/fixtures';
import { MessagesPanel } from './MessagesPanel';

function renderPanel(active: boolean) {
  const view = render(
    <Intl locale="en">
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <MessagesPanel job={makeJob()} active={active} />
      </DataProvider>
    </Intl>,
  );
  return view;
}

describe('MessagesPanel', () => {
  it('waits until you open the tab', () => {
    renderPanel(false);
    expect(screen.queryByText('Messages to copy')).not.toBeInTheDocument();
  });

  it('fills German drafts when the job needs German, with the recipient you type', async () => {
    renderPanel(true);
    expect(await screen.findByText('Messages to copy')).toBeInTheDocument();
    expect(screen.getByText(/In German, because the job needs German/)).toBeInTheDocument();
    expect(
      screen.getByText(/ich bin Ada, Frontend engineer mit 4 Jahren Erfahrung/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\d+\/300 characters/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Their name (optional)'), 'Anna');
    expect(screen.getByText(/^Hallo Anna, ich bin Ada/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Copy prompt and open/ })).toBeInTheDocument();
  });
});
