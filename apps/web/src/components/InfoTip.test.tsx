import { render, screen } from '@testing-library/react';
import { InfoTip } from './InfoTip';

describe('InfoTip', () => {
  it('describes its button with the tip text', () => {
    render(<InfoTip label="More about Skills" text="One skill per comma" />);
    const button = screen.getByRole('button', { name: 'More about Skills' });
    expect(button).toHaveAccessibleDescription('One skill per comma');
    // 24px to tap, even though the circle you see is 16px.
    expect(button).toHaveClass('h-6', 'w-6');
  });

  it('opens only from its own ⓘ, not from a parent group like a fold', () => {
    render(
      <details className="group" open>
        <summary>Settings</summary>
        <InfoTip label="More" text="Tip" />
        <input aria-label="Days" />
      </details>,
    );
    const tip = screen.getByRole('tooltip', { hidden: true });
    // A plain `group-focus-within:` would open it when the Days field next to it gets focus.
    expect(tip.className).toContain('group-focus-within/tip:block');
    expect(tip.className).toContain('group-hover/tip:block');
    expect(tip.className).not.toMatch(/(^|\s)group-(hover|focus-within):/);
    expect(tip.parentElement).toHaveClass('group/tip');
  });
});
