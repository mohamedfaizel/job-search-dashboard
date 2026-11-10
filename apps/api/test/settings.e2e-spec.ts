import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SchedulerService } from '../src/saved-searches/scheduler.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const SETTINGS = `query { appSettings { signupMode dailyCreditCap maxSavedSearches schedulerOn stillOpenOn schedulerOffInEnv stillOpenOffInEnv } }`;
const UPDATE = `mutation ($input: UpdateAppSettingsInput!) { updateAppSettings(input: $input) { signupMode dailyCreditCap maxSavedSearches schedulerOn } }`;
const INVITES = `query { invites { id token uses maxUses expiresAt state } }`;
const CREATE_INVITE = `mutation ($input: CreateInviteInput!) { createInvite(input: $input) { id token maxUses expiresAt state } }`;
const CANCEL_INVITE = `mutation ($id: Int!) { cancelInvite(id: $id) }`;
const STATE = `query ($invite: String) { signupState(invite: $invite) }`;
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { id role } }`;
const SAVE = `mutation ($name: String!) { createSavedSearch(input: { name: $name, titles: ["x"] }) { id } }`;
const BUDGET = `query { importBudget { cap } }`;

type Code = { errors?: { extensions?: Record<string, unknown> }[] };
const codeOf = (res: Code) => res.errors?.[0]?.extensions?.['apiCode'];
const person = (n: number, invite?: string) => ({
  input: { name: `P${n}`, email: `p${n}@x.de`, password: 'password-123', invite },
});

describe('admin: sign-up & access and limits', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ DAILY_CREDIT_CAP: '70' });
  });
  afterAll(async () => {
    Reflect.deleteProperty(process.env, 'DAILY_CREDIT_CAP');
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  const setMode = (signupMode: string) => t.gql(UPDATE, { input: { signupMode } });

  it('starts from .env, says when .env keeps a switch off, and is for admins only', async () => {
    const res = await t.gql<{ appSettings: Record<string, unknown> }>(SETTINGS);
    expect(res.data?.appSettings).toEqual({
      signupMode: 'OPEN',
      dailyCreditCap: 70,
      maxSavedSearches: 10,
      schedulerOn: true,
      stillOpenOn: true,
      // The tests' .env switches both off.
      schedulerOffInEnv: true,
      stillOpenOffInEnv: true,
    });
    expect(codeOf(await t.asUser(SETTINGS))).toBe('ADMIN_ONLY');
    expect(codeOf(await t.asUser(INVITES))).toBe('ADMIN_ONLY');
  });

  it('changes only what is sent, and the new limit works at once', async () => {
    const res = await t.gql<{ updateAppSettings: Record<string, unknown> }>(UPDATE, {
      input: { dailyCreditCap: 25, schedulerOn: null },
    });
    expect(res.data?.updateAppSettings).toMatchObject({ dailyCreditCap: 25, schedulerOn: true });
    expect((await t.asUser<{ importBudget: { cap: number } }>(BUDGET)).data?.importBudget.cap).toBe(
      25,
    );
    expect((await t.gql(UPDATE, { input: { maxSavedSearches: 0 } })).errors).toBeDefined();
  });

  it('keeps each user to the most saved searches', async () => {
    await t.gql(UPDATE, { input: { maxSavedSearches: 2 } });
    for (const name of ['A', 'B']) expect((await t.asUser(SAVE, { name })).errors).toBeUndefined();

    expect(codeOf(await t.asUser(SAVE, { name: 'C' }))).toBe('SAVED_SEARCHES_FULL');
    // Another user has their own count.
    expect((await t.gql(SAVE, { name: 'C' })).errors).toBeUndefined();
  });

  it('pauses scheduled searches when switched off', async () => {
    const scheduler = t.app.get(SchedulerService);
    const before = { ...process.env };
    process.env['SCHEDULER_ENABLED'] = 'true';
    try {
      await t.asUser(SAVE, { name: 'A' });
      await t.prisma.savedSearch.updateMany({
        data: { schedule: 'DAILY', nextRunAt: new Date(Date.now() - 60_000) },
      });
      await t.gql(UPDATE, { input: { schedulerOn: false } });
      await scheduler.tick();
      // Not run: still due.
      expect((await t.prisma.savedSearch.findFirstOrThrow()).nextRunAt!.getTime()).toBeLessThan(
        Date.now(),
      );
    } finally {
      process.env['SCHEDULER_ENABLED'] = before['SCHEDULER_ENABLED'];
    }
  });

  it('open: anyone can sign up', async () => {
    expect((await t.anonymous<{ signupState: string }>(STATE)).data?.signupState).toBe('OPEN');
    expect((await t.anonymous(SIGN_UP, person(3))).errors).toBeUndefined();
  });

  it('closed: no new accounts, not even with an invite', async () => {
    const invite = await t.gql<{ createInvite: { token: string } }>(CREATE_INVITE, { input: {} });
    const token = invite.data!.createInvite.token;
    await setMode('CLOSED');

    expect(
      (await t.anonymous<{ signupState: string }>(STATE, { invite: token })).data?.signupState,
    ).toBe('CLOSED');
    expect(codeOf(await t.anonymous(SIGN_UP, person(3, token)))).toBe('SIGNUP_CLOSED');
  });

  it('invite only: needs a working link, and a link used once is used up', async () => {
    await setMode('INVITE');
    const made = await t.gql<{
      createInvite: {
        id: number;
        token: string;
        maxUses: number;
        expiresAt: string;
        state: string;
      };
    }>(CREATE_INVITE, { input: { expiresInDays: 7, maxUses: 1 } });
    const invite = made.data!.createInvite;
    expect(invite).toMatchObject({ maxUses: 1, state: 'ACTIVE' });
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    const state = async (code?: string) =>
      (await t.anonymous<{ signupState: string }>(STATE, { invite: code })).data?.signupState;
    expect(await state()).toBe('NEEDS_INVITE');
    expect(await state('nope')).toBe('INVITE_INVALID');
    expect(await state(invite.token)).toBe('INVITED');

    expect(codeOf(await t.anonymous(SIGN_UP, person(3)))).toBe('INVITE_NEEDED');
    const ok = await t.anonymous<{ signUp: { role: string } }>(SIGN_UP, person(3, invite.token));
    expect(ok.data?.signUp.role).toBe('USER');

    expect(await state(invite.token)).toBe('INVITE_INVALID');
    expect(codeOf(await t.anonymous(SIGN_UP, person(4, invite.token)))).toBe('INVITE_INVALID');
    const list = await t.gql<{ invites: { uses: number; state: string }[] }>(INVITES);
    expect(list.data?.invites).toEqual([expect.objectContaining({ uses: 1, state: 'USED_UP' })]);
  });

  it('cancels and expires invite links', async () => {
    await setMode('INVITE');
    const made = await t.gql<{ createInvite: { id: number; token: string } }>(CREATE_INVITE, {
      input: {},
    });
    const { id, token } = made.data!.createInvite;

    expect((await t.gql<{ cancelInvite: number }>(CANCEL_INVITE, { id })).data?.cancelInvite).toBe(
      id,
    );
    expect(codeOf(await t.gql(CANCEL_INVITE, { id }))).toBe('INVITE_NOT_FOUND');
    expect((await t.gql<{ invites: unknown[] }>(INVITES)).data?.invites).toEqual([]);
    expect(codeOf(await t.anonymous(SIGN_UP, person(3, token)))).toBe('INVITE_INVALID');

    const old = await t.prisma.invite.create({
      data: { token: 'old', expiresAt: new Date(Date.now() - 1000) },
    });
    const list = await t.gql<{ invites: { id: number; state: string }[] }>(INVITES);
    expect(list.data?.invites).toEqual([expect.objectContaining({ id: old.id, state: 'EXPIRED' })]);
    expect(codeOf(await t.anonymous(SIGN_UP, person(3, 'old')))).toBe('INVITE_INVALID');
  });

  it('always lets the very first account in, as the admin', async () => {
    await setMode('CLOSED');
    await t.prisma.user.deleteMany();

    expect((await t.anonymous<{ signupState: string }>(STATE)).data?.signupState).toBe('OPEN');
    const first = await t.anonymous<{ signUp: { role: string } }>(SIGN_UP, person(3));
    expect(first.data?.signUp.role).toBe('ADMIN');
    expect(codeOf(await t.anonymous(SIGN_UP, person(4)))).toBe('SIGNUP_CLOSED');
  });
});
