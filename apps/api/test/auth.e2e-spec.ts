import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GqlResult, TestApp } from './helpers';
import { createTestApp, resetDatabase } from './helpers';

const ME = `query { me { id email name role } }`;
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { id email name role } }`;
const LOG_IN = `mutation ($input: LogInInput!) { logIn(input: $input) { email role } }`;
const LOG_OUT = `mutation { logOut }`;
const JOBS = `query { jobsPage { total } }`;
const SYNC = `mutation { syncJobs(input: { titles: ["frontend"] }) { fetched } }`;
const SAVED = `query { savedSearches { id } }`;

const MOHAMED = { name: 'Mohamed', email: 'Mohamed@Example.com ', password: 'correct horse' };
const VISITOR = { name: 'Visitor', email: 'visitor@example.com', password: 'visitor-pass' };

describe('auth', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  /** A browser-like client that keeps cookies between requests. */
  function browser() {
    const agent = request.agent(t.server);
    const gql = async <T>(query: string, variables?: Record<string, unknown>) => {
      const res = await agent.post('/graphql').send({ query, variables });
      return { body: res.body as GqlResult<T>, cookies: res.headers['set-cookie'] as unknown };
    };
    return gql;
  }

  it('turns away callers who are not logged in, except for public endpoints', async () => {
    const jobs = await t.anonymous(JOBS);
    expect(jobs.errors?.[0]?.message).toBe('Please log in');

    expect((await t.anonymous<{ me: null }>(ME)).data).toEqual({ me: null });
    const health = await request(t.server).get('/health');
    expect(health.status).toBe(200);
  });

  it('makes the first account the admin and keeps it logged in with an httpOnly cookie', async () => {
    const gql = browser();

    const signUp = await gql<{ signUp: { email: string; role: string } }>(SIGN_UP, {
      input: MOHAMED,
    });

    expect(signUp.body.data?.signUp).toMatchObject({
      email: 'mohamed@example.com',
      name: 'Mohamed',
      role: 'ADMIN',
    });
    expect(String(signUp.cookies)).toMatch(
      /^session=.+; Max-Age=604800; Path=\/;.*HttpOnly; SameSite=Lax/,
    );
    expect((await gql<{ me: { email: string } }>(ME)).body.data?.me.email).toBe(
      'mohamed@example.com',
    );
    expect((await gql(JOBS)).body.errors).toBeUndefined();

    const stored = await t.prisma.user.findFirstOrThrow();
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('makes later accounts regular users who cannot spend credits', async () => {
    await browser()(SIGN_UP, { input: MOHAMED });
    const gql = browser();

    const signUp = await gql<{ signUp: { role: string } }>(SIGN_UP, { input: VISITOR });

    expect(signUp.body.data?.signUp.role).toBe('USER');
    expect((await gql(JOBS)).body.errors).toBeUndefined();
    expect((await gql(SYNC)).body.errors?.[0]?.message).toBe('Only the admin can do this');
    expect((await gql(SAVED)).body.errors?.[0]?.message).toBe('Only the admin can do this');
    expect((await t.asUser(SAVED)).errors?.[0]?.message).toBe('Only the admin can do this');
  });

  it('refuses a second account with the same email, whatever its case', async () => {
    await browser()(SIGN_UP, { input: MOHAMED });

    const again = await browser()(SIGN_UP, {
      input: { ...VISITOR, email: 'MOHAMED@example.com' },
    });

    expect(again.body.errors?.[0]?.message).toBe('An account with this email already exists');
  });

  it('checks the sign-up form', async () => {
    const res = await browser()(SIGN_UP, {
      input: { name: ' ', email: 'not-an-email', password: 'short' },
    });

    expect(res.body.errors?.[0]?.message).toBe(
      'Enter your name (up to 80 characters); Enter a valid email address; Use a password of at least 8 characters',
    );
    expect(await t.prisma.user.count()).toBe(0);
  });

  it('logs in with the right password and gives the same answer for any wrong one', async () => {
    await browser()(SIGN_UP, { input: MOHAMED });

    const wrongPassword = await browser()(LOG_IN, {
      input: { email: MOHAMED.email, password: 'nope-nope' },
    });
    const unknownEmail = await browser()(LOG_IN, {
      input: { email: 'nobody@example.com', password: MOHAMED.password },
    });
    expect(wrongPassword.body.errors?.[0]?.message).toBe('Wrong email or password');
    expect(unknownEmail.body.errors?.[0]?.message).toBe('Wrong email or password');

    const gql = browser();
    const ok = await gql<{ logIn: { role: string } }>(LOG_IN, {
      input: { email: 'MOHAMED@example.com', password: MOHAMED.password },
    });
    expect(ok.body.data?.logIn.role).toBe('ADMIN');
    expect((await gql(SAVED)).body.errors).toBeUndefined();
  });

  it('logs out by clearing the cookie', async () => {
    const gql = browser();
    await gql(SIGN_UP, { input: MOHAMED });

    const out = await gql(LOG_OUT);

    expect(String(out.cookies)).toMatch(/^session=; Path=\/; Expires=Thu, 01 Jan 1970/);
    expect((await gql<{ me: null }>(ME)).body.data?.me).toBeNull();
    expect((await gql(JOBS)).body.errors?.[0]?.message).toBe('Please log in');
  });

  it('ignores a forged session cookie', async () => {
    const forged = await request(t.server)
      .post('/graphql')
      .set('Cookie', 'session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJBRE1JTiJ9.forged')
      .send({ query: JOBS });

    expect((forged.body as GqlResult<unknown>).errors?.[0]?.message).toBe('Please log in');
  });
});

describe('auth with sign-up closed', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ ALLOW_SIGNUP: 'false' });
    await resetDatabase(t.prisma);
  });
  afterAll(async () => {
    Reflect.deleteProperty(process.env, 'ALLOW_SIGNUP');
    await t.app.close();
  });

  it('refuses new accounts', async () => {
    const res = await t.anonymous(SIGN_UP, { input: MOHAMED });

    expect(res.errors?.[0]?.message).toBe('Sign-up is closed on this server');
  });
});
