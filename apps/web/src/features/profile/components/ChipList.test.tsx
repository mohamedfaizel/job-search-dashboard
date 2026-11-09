import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithData } from '../test/render';
import { ChipList } from './ChipList';

function List({ start }: { start: string }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <ChipList
        label="Skills"
        addLabel="Add a skill, press Enter"
        value={value}
        missing={[]}
        onChange={setValue}
      />
      <output>{value}</output>
    </>
  );
}

describe('chip list', () => {
  it('shows two rows, then "+ N more", and skips a chip you already have', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 15 }, (_, i) => `skill${String(i + 1)}`).join(', ');
    renderWithData(<List start={many} />);
    expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: '+ 3 more' }));
    expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(15);
    await user.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(12);

    await user.type(screen.getByRole('textbox'), 'SKILL1, Vue{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent(`${many}, Vue`);
  });
});
