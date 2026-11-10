import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const USERS = `query { adminUsers { id name email role disabled hasJobKey importsThisMonth lastSeenAt } }`;
const SET_ROLE = `mutation ($input: SetUserRoleInput!) { setUserRole(input: $input) { id role } }`;
const SET_DISABLED = `mutation ($input: SetUserDisabledInput!) { setUserDisabled(input: $input) { id disabled } }`;
const DELETE = `mutation ($input: DeleteUserInput!) { deleteUser(input: $input) }`;
const ME = `query { me { id role } }`;
const LOG_IN = `mutation ($input: LogInInput!) { logIn(input: $input) { id } }`;
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { id role } }`;

type Code = { errors?: { extensions?: Record<string, unknown> }[] };
const codeOf = (res: Code) => res.errors?.[0]?.extensions?.['apiCode'];

describe('admin: users', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  it('lists every account with counts only, for admins', async () => {
    await t.prisma.apiKey.create({
      data: { userId: 2, kind: 'JOBHUNTER', secret: 'enc', last4: 'abcd' },
    });
    await t.prisma.syncRun.create({
      data: {
        userId: 2,
        searchKey: 'k',
        input: {},
        startedAt: new Date(),
        complete: true,
        fetched: 3,
        created: 3,
        updated: 0,
      },
    });

    const res = await t.gql<{ adminUsers: Record<string, unknown>[] }>(USERS);

    expect(res.errors).toBeUndefined();
    expect(res.data?.adminUsers).toEqual([
      expect.objectContaining({ id: 1, role: 'ADMIN', hasJobKey: false, importsThisMonth: 0 }),
      expect.objectContaining({ id: 2, role: 'USER', hasJobKey: true, importsThisMonth: 1 }),
    ]);
    // The admin's own call counts as using the app.
    expect(res.data?.adminUsers[0]?.['lastSeenAt']).not.toBeNull();
  });

  it('turns away normal users', async () => {
    const res = await t.asUser(USERS);
    expect(codeOf(res)).toBe('ADMIN_ONLY');
  });

  it('makes a user admin, and the new role works at once', async () => {
    const res = await t.gql(SET_ROLE, { input: { userId: 2, role: 'ADMIN' } });
    expect(res.errors).toBeUndefined();

    // Same cookie as before (it still says USER): the role comes from the database.
    expect((await t.asUser(USERS)).errors).toBeUndefined();
    expect((await t.asUser<{ me: { role: string } }>(ME)).data?.me.role).toBe('ADMIN');
  });

  it("doesn't let an admin change their own account, so the app never loses its last admin", async () => {
    expect(codeOf(await t.gql(SET_ROLE, { input: { userId: 1, role: 'USER' } }))).toBe(
      'NOT_ON_YOURSELF',
    );
    expect(codeOf(await t.gql(SET_DISABLED, { input: { userId: 1, disabled: true } }))).toBe(
      'NOT_ON_YOURSELF',
    );
    expect(
      codeOf(await t.gql(DELETE, { input: { userId: 1, confirmEmail: 'admin@example.com' } })),
    ).toBe('NOT_ON_YOURSELF');
    expect(await t.prisma.user.findUnique({ where: { id: 1 } })).toMatchObject({ role: 'ADMIN' });
  });

  it('switches an account off: its session stops working and it can’t log in', async () => {
    await t.prisma.user.create({
      data: { id: 3, email: 'off@example.com', name: 'Off', passwordHash: 'x' },
    });
    const off = await t.gql<{ setUserDisabled: { disabled: boolean } }>(SET_DISABLED, {
      input: { userId: 2, disabled: true },
    });
    expect(off.data?.setUserDisabled.disabled).toBe(true);

    expect((await t.asUser<{ me: null }>(ME)).data?.me).toBeNull();
    expect(codeOf(await t.asUser(`query { savedSearches { id } }`))).toBe('LOGIN_REQUIRED');

    const on = await t.gql(SET_DISABLED, { input: { userId: 2, disabled: false } });
    expect(on.errors).toBeUndefined();
    expect((await t.asUser<{ me: { id: number } }>(ME)).data?.me.id).toBe(2);
  });

  it('refuses the login of a switched-off account with the right password', async () => {
    const agent = request.agent(t.server);
    await resetDatabase(t.prisma);
    const first = await agent.post('/graphql').send({
      query: SIGN_UP,
      variables: { input: { name: 'A', email: 'a@x.de', password: 'password-a' } },
    });
    type SignedUp = { data: { signUp: { id: number; role: string } } };
    expect((first.body as SignedUp).data.signUp.role).toBe('ADMIN');
    const second = await request(t.server)
      .post('/graphql')
      .send({
        query: SIGN_UP,
        variables: { input: { name: 'B', email: 'b@x.de', password: 'password-b' } },
      });
    const bId = (second.body as SignedUp).data.signUp.id;

    const off = await agent
      .post('/graphql')
      .send({ query: SET_DISABLED, variables: { input: { userId: bId, disabled: true } } });
    expect((off.body as Code).errors).toBeUndefined();

    const login = await request(t.server)
      .post('/graphql')
      .send({ query: LOG_IN, variables: { input: { email: 'b@x.de', password: 'password-b' } } });
    expect(codeOf(login.body as Code)).toBe('ACCOUNT_DISABLED');
    const wrong = await request(t.server)
      .post('/graphql')
      .send({ query: LOG_IN, variables: { input: { email: 'b@x.de', password: 'nope-nope' } } });
    expect(codeOf(wrong.body as Code)).toBe('WRONG_LOGIN');
  });

  it('deletes an account and all its data only with its email typed again', async () => {
    await t.prisma.story.create({
      data: { userId: 2, title: 'Story', situation: '', task: '', action: '', result: '' },
    });

    const wrong = await t.gql(DELETE, { input: { userId: 2, confirmEmail: 'someone@else.de' } });
    expect(codeOf(wrong)).toBe('CONFIRM_EMAIL_MISMATCH');
    expect(await t.prisma.user.count({ where: { id: 2 } })).toBe(1);

    const res = await t.gql<{ deleteUser: number }>(DELETE, {
      input: { userId: 2, confirmEmail: ' User@Example.com ' },
    });
    expect(res.data?.deleteUser).toBe(2);
    expect(await t.prisma.user.count({ where: { id: 2 } })).toBe(0);
    expect(await t.prisma.story.count()).toBe(0);
    // The deleted account's cookie no longer works.
    expect((await t.asUser<{ me: null }>(ME)).data?.me).toBeNull();
  });
});
