import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { isPushToken, PushService } from './push.service';

const MESSAGE = { title: 'Good morning', body: 'Best: Job a', url: '/alerts' };

function fakePrisma(tokens: { id: number; token: string }[]) {
  const pushToken = {
    findMany: vi.fn().mockResolvedValue(tokens),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({}),
  };
  return { prisma: { pushToken } as unknown as PrismaService, pushToken };
}

describe('PushService', () => {
  const two = [
    { id: 1, token: 'ExponentPushToken[a]' },
    { id: 2, token: 'ExponentPushToken[b]' },
  ];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('knows a real Expo token', () => {
    expect(isPushToken('ExponentPushToken[abc]')).toBe(true);
    expect(isPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isPushToken('hello')).toBe(false);
  });

  it('registers and forgets a phone', async () => {
    const { prisma, pushToken } = fakePrisma([]);
    const push = new PushService(prisma);
    await push.register(1, 'ExponentPushToken[a]');
    expect(pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'ExponentPushToken[a]' }, update: { userId: 1 } }),
    );
    await push.unregister(1, 'ExponentPushToken[a]');
    expect(pushToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, token: 'ExponentPushToken[a]' },
    });
  });

  it('sends nothing without a phone', async () => {
    const { prisma } = fakePrisma([]);
    expect(await new PushService(prisma).send(1, MESSAGE)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts the phones that took it and forgets uninstalled ones', async () => {
    const { prisma, pushToken } = fakePrisma(two);
    fetchMock.mockResolvedValue(
      Response.json({
        data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    );
    expect(await new PushService(prisma).send(1, MESSAGE)).toBe(1);
    expect(pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [2] } } });
  });

  it('never throws when Expo says no or is down', async () => {
    const { prisma } = fakePrisma(two);
    const push = new PushService(prisma);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect(await push.send(1, MESSAGE)).toBe(0);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await push.send(1, MESSAGE)).toBe(0);
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect(await push.send(1, MESSAGE)).toBe(0);
  });
});
