import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const GET = `query { myTableSettings }`;
const SAVE = `mutation ($settings: String!) { saveTableSettings(settings: $settings) }`;

describe('saved Job posts filters', () => {
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

  it('has nothing saved at first', async () => {
    const res = await t.asUser<{ myTableSettings: string | null }>(GET);
    expect(res.data?.myTableSettings).toBeNull();
  });

  it('keeps your settings, and replaces them when you save again', async () => {
    const first = JSON.stringify({ minFit: 70 });
    expect((await t.asUser(SAVE, { settings: first })).data).toEqual({ saveTableSettings: true });
    expect((await t.asUser<{ myTableSettings: string }>(GET)).data?.myTableSettings).toBe(first);

    const second = JSON.stringify({ minFit: 50, pageSize: 50 });
    await t.asUser(SAVE, { settings: second });
    expect((await t.asUser<{ myTableSettings: string }>(GET)).data?.myTableSettings).toBe(second);
  });

  it('keeps them per user', async () => {
    await t.asUser(SAVE, { settings: JSON.stringify({ minFit: 70 }) });
    const admin = await t.gql<{ myTableSettings: string | null }>(GET);
    expect(admin.data?.myTableSettings).toBeNull();
  });

  it('refuses text that is not a small JSON object', async () => {
    for (const settings of ['nope', '[1]', '"x"', JSON.stringify({ big: 'x'.repeat(5000) })]) {
      const res = await t.asUser(SAVE, { settings });
      expect(res.errors?.[0]?.message).toMatch(/small JSON object/);
    }
    expect(
      (await t.asUser<{ myTableSettings: string | null }>(GET)).data?.myTableSettings,
    ).toBeNull();
  });
});
