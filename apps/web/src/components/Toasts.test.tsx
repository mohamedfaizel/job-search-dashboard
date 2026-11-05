import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '../test/intl';
import { ToastProvider, useToast } from './Toasts';

function Buttons() {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          toast('Changes saved.');
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          toast('Could not save', { tone: 'error' });
        }}
      >
        Fail
      </button>
    </>
  );
}

describe('Toasts', () => {
  it('shows a message, an error as an alert, and closes on ×', async () => {
    const user = userEvent.setup();
    render(
      <Intl locale="en">
        <ToastProvider>
          <Buttons />
        </ToastProvider>
      </Intl>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('status')).toHaveTextContent('Changes saved.');
    await user.click(screen.getByRole('button', { name: 'Fail' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');

    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does nothing without a provider', async () => {
    const user = userEvent.setup();
    render(<Buttons />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
