import { render, screen, within } from '@testing-library/react';
import { Intl } from '../../test/intl';
import { AboutPage } from './AboutPage';

describe('AboutPage', () => {
  it('tells the story, the values and how to get in touch', () => {
    render(
      <Intl>
        <AboutPage loggedIn={false} />
      </Intl>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "One person's job search, now shared with everyone",
    );
    for (const name of ['The story', 'What we believe', "How it's built"]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    const contact = screen.getByRole('region', { name: 'Queries and suggestions welcome' });
    expect(within(contact).getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mohamedfaizel',
    );
    // About us is the page you are on.
    expect(screen.getByRole('link', { name: 'About us', current: 'page' })).toBeInTheDocument();
  });

  it('speaks German', () => {
    render(
      <Intl locale="de">
        <AboutPage loggedIn />
      </Intl>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Die Jobsuche einer Person, jetzt für alle',
    );
    expect(screen.getByRole('link', { name: 'Meine Jobs öffnen' })).toHaveAttribute(
      'href',
      '/jobs',
    );
  });
});
