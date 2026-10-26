import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Layout } from './Layout';

describe('Layout', () => {
  it('marks the current view in the navigation', () => {
    render(
      <Layout current="dashboard" onNavigate={() => {}}>
        content
      </Layout>,
    );
    expect(screen.getByRole('button', { name: 'Job posts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Add jobs' })).not.toHaveAttribute('aria-current');
  });

  it('asks to navigate when a nav item is clicked', async () => {
    const onNavigate = vi.fn();
    render(
      <Layout current="dashboard" onNavigate={onNavigate}>
        content
      </Layout>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add jobs' }));
    expect(onNavigate).toHaveBeenCalledWith('add-job');
  });
});
