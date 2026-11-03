import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessRevokedError, GmailClient } from './gmail.client';

const settings: Record<string, string> = {
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};
const make = (over: Record<string, string> = {}) =>
  new GmailClient({ get: (key: string) => ({ ...settings, ...over })[key] } as ConfigService);

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GmailClient', () => {
  it('is only configured with both a client id and a secret', () => {
    expect(make().configured).toBe(true);
    expect(make({ GOOGLE_CLIENT_SECRET: '' }).configured).toBe(false);
    expect(make({ GOOGLE_CLIENT_ID: '' }).configured).toBe(false);
  });

  it('builds a read-only, offline sign-in link', () => {
    const url = new URL(make().authUrl('state-1'));
    expect(url.searchParams.get('client_id')).toBe('id');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/gmail/callback');
    expect(url.searchParams.get('scope')).toContain('gmail.readonly');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(make({ GMAIL_REDIRECT_URI: 'https://x.test/cb' }).redirectUri).toBe('https://x.test/cb');
  });

  it('trades a code for the address and the refresh token', async () => {
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(reply({ access_token: 'a', refresh_token: 'r' }))
      .mockReturnValueOnce(reply({ email: 'me@gmail.com' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await make().exchangeCode('code')).toEqual({
      email: 'me@gmail.com',
      refreshToken: 'r',
    });
    const body = (fetchMock.mock.calls[0]?.[1] as { body: URLSearchParams }).body;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code');
  });

  it('fails clearly when Google leaves something out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({})));
    await expect(make().exchangeCode('c')).rejects.toThrow('no access token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(reply({ access_token: 'a' }))
        .mockReturnValueOnce(reply({}, 401)),
    );
    await expect(make().exchangeCode('c')).rejects.toThrow('which account');
  });

  it('exchanges a refresh token for an access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({ access_token: 'fresh' })));
    expect(await make().accessToken('r')).toBe('fresh');
  });

  it('tells a revoked token from other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({ error: 'invalid_grant' }, 400)));
    await expect(make().accessToken('r')).rejects.toBeInstanceOf(AccessRevokedError);
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({}, 500)));
    await expect(make().accessToken('r')).rejects.toThrow('Google answered 500');
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({})));
    await expect(make().accessToken('r')).rejects.toThrow('no access token');
  });

  it('reads recent mail: sender, subject, snippet and date', async () => {
    const message = (id: string) => ({
      id,
      snippet: `snippet ${id}`,
      internalDate: '1793700000000',
      payload: {
        headers: [
          { name: 'From', value: 'HR <hr@acme.de>' },
          { name: 'Subject', value: `Subject ${id}` },
        ],
      },
    });
    const ids = ['1', '2', '3', '4', '5', '6'];
    const fetchMock = vi.fn((url: string) =>
      url.includes('/messages?')
        ? reply({ messages: ids.map((id) => ({ id })) })
        : reply(message(url.split('/messages/')[1]?.split('?')[0] ?? '')),
    );
    vi.stubGlobal('fetch', fetchMock);
    const mails = await make().recentMail('token', 14, 100);
    expect(mails).toHaveLength(6);
    expect(mails[0]).toEqual({
      id: '1',
      from: 'HR <hr@acme.de>',
      subject: 'Subject 1',
      snippet: 'snippet 1',
      receivedAt: new Date(1793700000000),
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('newer_than%3A14d');
  });

  it('handles an empty inbox, a bare message and a failing Gmail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({})));
    expect(await make().recentMail('t', 14, 10)).toEqual([]);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(reply({ messages: [{ id: 'x' }] }))
        .mockReturnValueOnce(reply({ id: 'x' })),
    );
    const [bare] = await make().recentMail('t', 14, 10);
    expect(bare).toMatchObject({ id: 'x', from: '', subject: '', snippet: '' });
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(reply({}, 403)));
    await expect(make().recentMail('t', 14, 10)).rejects.toThrow('Gmail answered 403');
  });

  it('asks Google to revoke a token', async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(reply({}));
    vi.stubGlobal('fetch', fetchMock);
    await make().revoke('r');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/revoke');
  });
});
