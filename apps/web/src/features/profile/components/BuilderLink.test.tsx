import { render, screen } from '@testing-library/react';
import { Intl } from '@/test/intl';
import { BuilderLink } from './BuilderLink';

describe('BuilderLink', () => {
  it('says when there is no resume text yet', () => {
    render(
      <Intl>
        <BuilderLink text="  " />
      </Intl>,
    );
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Resume builder' })).toHaveAttribute(
      'href',
      '/resume',
    );
  });
});
