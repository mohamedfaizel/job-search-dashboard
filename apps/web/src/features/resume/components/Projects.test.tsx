import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { server } from '../../profile/test/server';
import { ResumeBuilderPage } from '../ResumeBuilderPage';
import { builderHandlers, lastSaved } from '../test/server';

const SAVE_WAIT = { timeout: 3000 };

async function renderBuilder() {
  server.use(...builderHandlers);
  const user = userEvent.setup();
  renderWithData(<ResumeBuilderPage />);
  await screen.findByRole('heading', { name: 'Resume builder' });
  return user;
}

const experience = () => screen.getByRole('region', { name: 'Experience' });
const entries = () => {
  const doc = lastSaved();
  return doc?.sections.find((s) => s.title === 'Experience')?.blocks ?? [];
};

describe('Projects and companies', () => {
  it('adds a project to a company with its tech and bullets', async () => {
    const user = await renderBuilder();
    await user.click(
      within(experience()).getAllByRole('button', { name: '+ Project' })[0] as HTMLElement,
    );
    await user.type(
      within(experience()).getByRole('textbox', { name: 'Project name' }),
      'ATM platform',
    );
    await user.type(
      within(experience()).getByRole('textbox', { name: 'Tech used' }),
      'React, MQTT',
    );
    const bullet = within(experience())
      .getAllByRole('textbox', { name: /^Bullet \d$/ })
      .at(-1) as HTMLElement;
    await user.type(bullet, '80% fewer penalties');
    await waitFor(() => {
      expect(entries()[0]).toMatchObject({
        projects: [{ name: 'ATM platform', tech: 'React, MQTT', bullets: ['80% fewer penalties'] }],
      });
    }, SAVE_WAIT);
  });

  it('collapses a project and a company, and moves or deletes a project', async () => {
    const user = await renderBuilder();
    const add = within(experience()).getAllByRole('button', {
      name: '+ Project',
    })[0] as HTMLElement;
    await user.click(add);
    await user.click(add);
    const names = within(experience()).getAllByRole('textbox', { name: 'Project name' });
    await user.type(names[0] as HTMLElement, 'First');
    await user.type(names[1] as HTMLElement, 'Second');
    await user.click(screen.getByRole('button', { name: 'Move project Second up' }));
    await waitFor(() => {
      expect(entries()[0]).toMatchObject({ projects: [{ name: 'Second' }, { name: 'First' }] });
    }, SAVE_WAIT);

    await user.click(screen.getByRole('button', { name: 'Collapse project Second' }));
    expect(screen.getAllByText('0 bullets')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Expand project Second' }));

    await user.click(screen.getByRole('button', { name: /^Collapse Acme GmbH/ }));
    expect(screen.getByRole('button', { name: /^Expand Acme GmbH/ })).toHaveTextContent(
      '2 projects',
    );
    await user.click(screen.getByRole('button', { name: /^Expand Acme GmbH/ }));

    await user.click(screen.getByRole('button', { name: 'Delete project Second' }));
    await waitFor(() => {
      expect(entries()[0]).toMatchObject({ projects: [{ name: 'First' }] });
    }, SAVE_WAIT);
  });

  it('calls a new entry in Experience the next company, and copies one as a starting point', async () => {
    const user = await renderBuilder();
    expect(
      within(experience()).getByRole('button', { name: '+ Next company' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Copy 1 in Experience as a starting point' }),
    );
    await waitFor(() => {
      expect(entries()).toHaveLength(2);
    }, SAVE_WAIT);
    expect(entries()[1]).toMatchObject({ title: 'Frontend Engineer', org: 'Acme GmbH' });
    expect(entries()[1]?.id).not.toBe(entries()[0]?.id);
  });
});
