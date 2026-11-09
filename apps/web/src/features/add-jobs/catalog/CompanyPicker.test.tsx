import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Intl } from '@/test/intl';
import { CATALOG_GROUPS, COMPANY_CATALOG } from './companies';
import { CompanyPicker } from './CompanyPicker';

function Harness({ start = '' }: { start?: string }) {
  const [value, setValue] = useState(start);
  return (
    <Intl locale="en">
      <output aria-label="boards">{value}</output>
      <CompanyPicker value={value} onChange={setValue} />
    </Intl>
  );
}

const boards = () => screen.getByRole('status', { name: 'boards' }).textContent;

describe('company catalog', () => {
  it('has 100+ readable boards, each once, in a known group', () => {
    expect(COMPANY_CATALOG.length).toBeGreaterThanOrEqual(100);
    const keys = COMPANY_CATALOG.map((c) => c.board);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of COMPANY_CATALOG) {
      expect(c.board).toMatch(/^(greenhouse|lever|ashby):[a-z0-9][a-z0-9._-]*$/);
      expect(CATALOG_GROUPS).toContain(c.group);
    }
  });
});

describe('CompanyPicker', () => {
  it('opens, searches by name or place, and ticks boards in and out', async () => {
    render(<Harness start="Greenhouse:N26" />);
    await userEvent.click(
      screen.getByRole('button', { name: `Pick from ${COMPANY_CATALOG.length} companies` }),
    );
    // Typed in another case, it still counts as picked.
    expect(screen.getByRole('checkbox', { name: /^N26/ })).toBeChecked();
    expect(screen.getByText('1 picked')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'munich');
    expect(screen.getByRole('checkbox', { name: /Celonis/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^N26/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Celonis/ }));
    expect(boards()).toBe('Greenhouse:N26, greenhouse:celonis');

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No company matches.')).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.click(screen.getByRole('checkbox', { name: /^N26/ }));
    expect(boards()).toBe('greenhouse:celonis');

    await userEvent.click(screen.getByRole('button', { name: 'Close the company list' }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('adds a whole group at once', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /^Pick from/ }));
    await userEvent.click(screen.getByRole('button', { name: 'AI & data' }));
    expect(screen.getByRole('button', { name: 'AI & data' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const ai = COMPANY_CATALOG.filter((c) => c.group === 'ai');
    await userEvent.click(screen.getByRole('button', { name: `Add all ${ai.length} shown` }));
    expect(boards()).toBe(ai.map((c) => c.board).join(', '));
    expect(screen.queryByRole('button', { name: /^Add all/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText(`${ai.length} picked`)).toBeInTheDocument();
  });

  it('removes all picked companies at once and keeps boards you typed', async () => {
    render(<Harness start="lever:mine" />);
    await userEvent.click(screen.getByRole('button', { name: /^Pick from/ }));
    expect(screen.queryByRole('button', { name: /^Remove all/ })).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: `Add all ${COMPANY_CATALOG.length} shown` }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: `Remove all ${COMPANY_CATALOG.length}` }),
    );
    expect(boards()).toBe('lever:mine');
    expect(screen.getByText('0 picked')).toBeInTheDocument();
  });
});
