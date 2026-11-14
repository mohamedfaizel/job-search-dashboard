import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Intl } from '@/test/intl';
import { CountrySelect } from './CountrySelect';

/** The select inside a tiny form, so we can read the value it hands back. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Intl>
      <label htmlFor="countries">Countries</label>
      <CountrySelect id="countries" value={value} onChange={setValue} />
      <output aria-label="Value">{value}</output>
    </Intl>
  );
}

const value = () => screen.getByRole('status', { name: 'Value' }).textContent;
const input = () => screen.getByRole('combobox', { name: 'Countries' });

describe('CountrySelect', () => {
  it('starts on Worldwide, then lists the regions and JobHunter’s countries', async () => {
    render(<Harness />);
    await userEvent.click(input());

    const list = screen.getByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Worldwide (any country)');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    const regions = within(within(list).getByRole('group', { name: 'Regions' })).getAllByRole(
      'option',
    );
    expect(regions.map((o) => o.textContent)).toEqual([
      'DACH3 countries',
      'European Union27 countries',
      'Benelux3 countries',
      'Nordics5 countries',
      'UK & Ireland2 countries',
      'Middle East12 countries',
      'GCC (Gulf)6 countries',
    ]);
    const countries = within(within(list).getByRole('group', { name: 'Countries' })).getAllByRole(
      'option',
    );
    expect(countries[0]).toHaveTextContent('United States · US');
    expect(countries).toHaveLength(46);
  });

  it('picks a whole region as one chip, and removes it again', async () => {
    render(<Harness initial="LU" />);
    await userEvent.click(input());
    expect(screen.getByRole('option', { name: /Benelux/ })).toHaveTextContent('1 of 3 picked');

    await userEvent.click(screen.getByRole('option', { name: /DACH/ }));
    expect(value()).toBe('LU, DE, AT, CH');
    const picked = screen.getByRole('list', { name: 'Picked countries' });
    expect(
      within(picked)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['DACH · 3×', 'Luxembourg · LU×']);
    expect(screen.getByRole('option', { name: /DACH/ })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Remove DACH' }));
    expect(value()).toBe('LU');
  });

  it('picks the country, not a region, for its exact code', async () => {
    render(<Harness />);
    await userEvent.type(input(), 'lu{Enter}');

    expect(value()).toBe('LU');
  });

  it('finds a region by typing its name', async () => {
    render(<Harness />);
    await userEvent.type(input(), 'middle{Enter}');

    expect(value()).toBe('AE, SA, QA, KW, BH, OM, IL, JO, LB, IQ, EG, TR');
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
    await userEvent.type(input(), 'li');
    await userEvent.click(screen.getByRole('option', { name: 'Use code LI' }));

    expect(value()).toBe('LI');
    expect(screen.getByRole('list', { name: 'Picked countries' })).toHaveTextContent(
      'Liechtenstein · LI',
    );
  });
});
