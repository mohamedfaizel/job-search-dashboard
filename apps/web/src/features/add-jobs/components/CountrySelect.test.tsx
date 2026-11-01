import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CountrySelect } from './CountrySelect';

/** The select inside a tiny form, so we can read the value it hands back. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="countries">Countries</label>
      <CountrySelect id="countries" value={value} onChange={setValue} />
      <output aria-label="Value">{value}</output>
    </>
  );
}

const value = () => screen.getByRole('status', { name: 'Value' }).textContent;
const input = () => screen.getByRole('combobox', { name: 'Countries' });

describe('CountrySelect', () => {
  it('starts on Worldwide and lists JobsPipe’s countries', async () => {
    render(<Harness />);
    await userEvent.click(input());

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Worldwide (any country)');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveTextContent('United States · US');
    expect(options).toHaveLength(46);
  });

  it('picks several countries by name or code, and removes one', async () => {
    render(<Harness />);
    await userEvent.type(input(), 'germ');
    await userEvent.click(screen.getByRole('option', { name: 'Germany · DE' }));
    await userEvent.type(input(), 'at{Enter}');

    expect(value()).toBe('DE, AT');
    const picked = screen.getByRole('list', { name: 'Picked countries' });
    expect(picked).toHaveTextContent('Germany · DE');
    expect(picked).toHaveTextContent('Austria · AT');

    await userEvent.click(screen.getByRole('button', { name: 'Remove Germany' }));
    expect(value()).toBe('AT');
  });

  it('clears every country with Worldwide', async () => {
    render(<Harness initial="DE, CH" />);
    await userEvent.click(input());
    await userEvent.click(screen.getByRole('option', { name: 'Worldwide (any country)' }));

    expect(value()).toBe('');
  });

  it('accepts a 2-letter code that isn’t in the list', async () => {
    render(<Harness />);
    await userEvent.type(input(), 'lu');
    await userEvent.click(screen.getByRole('option', { name: 'Use code LU' }));

    expect(value()).toBe('LU');
    expect(screen.getByRole('list', { name: 'Picked countries' })).toHaveTextContent(
      'Luxembourg · LU',
    );
  });
});
