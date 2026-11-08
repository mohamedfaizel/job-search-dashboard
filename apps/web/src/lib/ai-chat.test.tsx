import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { api, server } from '@/test/server';
import { AiNameIntl, withAiName } from './ai-chat';

describe('withAiName', () => {
  it('puts the chat name into every text, however deep', () => {
    expect(
      withAiName({ a: 'Paste {ai}’s reply', b: { c: 'Open {ai} ↗', d: 'No AI' } }, 'ChatGPT'),
    ).toEqual({ a: 'Paste ChatGPT’s reply', b: { c: 'Open ChatGPT ↗', d: 'No AI' } });
  });
});

function Text() {
  const t = useTranslations('Demo');
  return <p>{t('open')}</p>;
}

describe('AiNameIntl', () => {
  it('names the chat of the AI you picked in Settings', async () => {
    server.use(
      api.query('Me', () =>
        HttpResponse.json({
          data: {
            me: {
              id: 1,
              email: 'a@b.c',
              name: 'A',
              role: 'USER',
              locale: 'en',
              aiProvider: 'OPENAI',
            },
          },
        }),
      ),
    );
    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ Demo: { open: 'Open {ai} ↗' } }}
        timeZone="UTC"
      >
        <DataProvider store={makeStore()} queryClient={createQueryClient()}>
          <AiNameIntl>
            <Text />
          </AiNameIntl>
        </DataProvider>
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText('Open ChatGPT ↗')).toBeInTheDocument();
  });
});
