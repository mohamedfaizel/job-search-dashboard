import { render, screen, within } from '@testing-library/react';
import { Intl } from '../../test/intl';
import { AboutContent, AboutPage } from './AboutPage';

describe('AboutPage', () => {
  it('fits the story, the values and how to get in touch on one compact page', () => {
    render(
      <Intl>
        <AboutPage />
      </Intl>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "One person's job search, now shared with everyone",
    );
    for (const name of ['The story', 'What we believe', "How it's built"]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    const hero = screen.getByRole('region', { name: /One person's job search/ });
    expect(within(hero).getByRole('img', { name: 'Mohamed Faizel' })).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mohamedfaizel',
    );
    // A visitor logs in first, then comes back with the message window open.
    expect(within(hero).getByRole('link', { name: 'Message Mohamed Faizel' })).toHaveAttribute(
      'href',
      '/login?next=%2Fabout%3Fmessage%3D1',
    );
    // The public header, with About us as the page you are on, and no footer.
    expect(screen.getByRole('link', { name: 'About us', current: 'page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('opens the message window when you are logged in, in German too', () => {
    render(
      <Intl locale="de">
        <AboutContent loggedIn />
      </Intl>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Die Jobsuche einer Person, jetzt für alle',
    );
    expect(screen.getByRole('button', { name: 'Nachricht an Mohamed Faizel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Was uns wichtig ist' })).toBeInTheDocument();
  });
});
