import { render, screen, within } from '@testing-library/react';
import type { Locale } from '@/i18n/config';
import { Intl } from '../../test/intl';
import { LegalLinks } from './LegalLinks';
import { ImpressumContent, PrivacyContent } from './LegalPages';

const page = (node: React.ReactNode, locale: Locale = 'en') =>
  render(<Intl locale={locale}>{node}</Intl>);

describe('Impressum', () => {
  it('names the provider with an email link', () => {
    page(<ImpressumContent />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Impressum');
    expect(screen.getByText(/§ 5 DDG/)).toBeInTheDocument();
    expect(screen.getAllByText('Mohamed Faizel Mohamed Abdullah').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'mohamedfaizel.js@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:mohamedfaizel.js@gmail.com',
    );
  });

  it('shows a clear note while the postal address is not set', () => {
    page(<ImpressumContent />);
    expect(screen.getByRole('note')).toHaveTextContent('Postal address missing');
  });
});

describe('Privacy policy', () => {
  it('covers keys, Google, admins and deleting the account', () => {
    page(<PrivacyContent />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy policy');
    for (const title of ['Who is responsible', 'What admins can see', 'Your rights']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText(/stored encrypted \(AES-256-GCM\)/)).toBeInTheDocument();
    expect(screen.getByText(/read-only access/)).toBeInTheDocument();
    expect(
      screen.getByText(/To delete your account, write to mohamedfaizel.js@gmail.com/),
    ).toBeInTheDocument();
  });

  it('is in German too', () => {
    page(<PrivacyContent />, 'de');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Datenschutzerklärung');
    expect(screen.getByRole('heading', { name: 'Was Admins sehen' })).toBeInTheDocument();
  });
});

describe('LegalLinks', () => {
  it('links both pages', () => {
    page(<LegalLinks />);
    const nav = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(nav).getByRole('link', { name: 'Impressum' })).toHaveAttribute(
      'href',
      '/impressum',
    );
    expect(within(nav).getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
