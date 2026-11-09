import type { BuilderSection } from '@jobsearch/data';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithData } from '../../profile/test/render';
import { SectionCard } from './SectionCard';

const entry = (id: string, org: string) => ({
  id,
  kind: 'entry' as const,
  title: 'Engineer',
  org,
  meta: '2020 - 2024',
  bullets: ['Built things'],
  lines: [],
});

function Card({ start }: { start: BuilderSection }) {
  const [section, setSection] = useState(start);
  return (
    <SectionCard
      section={section}
      index={0}
      count={1}
      profileLanguages={[]}
      gripProps={{}}
      rowProps={{}}
      dropHere={false}
      onChange={(next) => {
        setSection(next);
      }}
      onMove={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe('section card', () => {
  it('turns "Label: list" bullets in Skills into skills rows', async () => {
    const user = userEvent.setup();
    renderWithData(
      <Card
        start={{
          id: 's',
          title: 'Technical skills',
          hidden: false,
          blocks: [{ id: 'b', kind: 'bullets', items: ['**Frontend**: React', 'Testing: Jest'] }],
        }}
      />,
    );
    expect(screen.getByText('2 bullets look like “Label: list”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn into skills rows' }));
    expect(screen.queryByRole('button', { name: 'Turn into skills rows' })).toBeNull();
    const labels = screen.getAllByRole('textbox', { name: 'Skills label' });
    expect(labels.map((i) => (i as HTMLInputElement).value)).toEqual(['Frontend', 'Testing']);
  });

  it('folds and opens every job at once', async () => {
    const user = userEvent.setup();
    renderWithData(
      <Card
        start={{
          id: 'e',
          title: 'Experience',
          hidden: false,
          blocks: [entry('a', 'Acme'), entry('b', 'Globex')],
        }}
      />,
    );
    const card = screen.getByRole('region', { name: 'Experience' });
    expect(within(card).getAllByRole('textbox', { name: 'Bullet 1' })).toHaveLength(2);
    await user.click(within(card).getByRole('button', { name: 'Fold all' }));
    expect(within(card).queryByRole('textbox', { name: 'Bullet 1' })).toBeNull();
    expect(within(card).getByText(/Acme · Engineer/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Open all' }));
    expect(within(card).getAllByRole('textbox', { name: 'Bullet 1' })).toHaveLength(2);
  });
});
