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
    // A visitor logs in first, then comes back with the message window open.
    expect(within(contact).getByRole('link', { name: 'Message Mohamed Faizel' })).toHaveAttribute(
      'href',
      '/login?next=%2Fabout%3Fmessage%3D1',
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
    // Logged in, the button and the footer line open the message window here.
    expect(screen.getByRole('button', { name: 'Nachricht an Mohamed Faizel' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Fragen und Vorschläge willkommen/ }),
    ).toBeInTheDocument();
  });
});
