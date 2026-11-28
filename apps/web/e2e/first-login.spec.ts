import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** What a brand-new account sees, from sign-up to the first screens, in a real browser. */

const RESUME = new URL('./fixtures/resume.docx', import.meta.url).pathname;
let count = 0;
const newEmail = () => `new-${String(Date.now())}-${String((count += 1))}@example.com`;

async function signUp(
  page: Page,
  labels: { name: string; email: string; password: string; submit: string },
) {
  await page.getByLabel(labels.name).fill('Alex');
  await page.getByLabel(labels.email).fill(newEmail());
  await page.getByLabel(labels.password).fill('a long password');
  await page.getByRole('button', { name: labels.submit }).click();
  await expect(page).toHaveURL(/\/welcome$/);
}

const EN = { name: 'Name', email: 'Email', password: 'Password', submit: 'Create account' };
const TABS = 'Tabs';
const DE = { name: 'Name', email: 'E-Mail', password: 'Passwort', submit: 'Konto erstellen' };

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop only');

  test('a new account adds its key and resume, then finds its first jobs', async ({ page }) => {
    await page.goto('/signup');
    await signUp(page, EN);

    // Step 1: the job data key. Only its last 4 characters come back.
    await expect(page.getByRole('heading', { name: '1. Your job data key' })).toBeVisible();
    await page.getByPlaceholder('Paste your token').fill('jp_browser_test_1234abcd');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
    await expect(page.getByText('jp_browser_test_1234abcd')).toHaveCount(0);
    await page.getByRole('button', { name: 'Next ›' }).click();

    // Step 2: the AI key, skipped here.
    await expect(page.getByRole('heading', { name: '2. Your AI key (optional)' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now ›' }).click();

    // Step 3: the resume fills My profile.
    await page.locator('input[type=file]').setInputFiles(RESUME);
    await expect(page.getByText('Added to My profile › Personal:')).toBeVisible();
    await page.getByRole('button', { name: 'Next ›' }).click();

    // Step 4: done, with what to try next, on to the import.
    await expect(page.getByText('Job data key saved')).toBeVisible();
    await expect(page.getByText(/No AI key yet/)).toBeVisible();
    await expect(page.getByRole('heading', { name: "What's next" })).toBeVisible();
    await expect(page.getByText('Resume uploaded')).toBeVisible();
    await page.getByRole('button', { name: 'Find my first jobs ›' }).click();
    await expect(page).toHaveURL(/\/jobs\/add$/);

    // Add jobs opens on the import form; with a token it starts on JobHunter.
    await page.getByRole('tab', { name: 'Import jobs' }).click();
    await expect(page.getByRole('radio', { name: /^JobHunter/ })).toBeChecked();

    // The resume is on the Resume page and in My profile.
    await page.goto('/profile');
    await expect(page.getByLabel('Headline', { exact: true }).first()).toHaveValue(
      'Senior Software Engineer',
    );
  });

  test('a German sign-up stays German, and without a token the import starts on the Arbeitsagentur', async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: 'de-DE' });
    const page = await context.newPage();
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Konto erstellen' })).toBeVisible();
    await signUp(page, DE);

    // Before the fix the app switched to English here.
    await expect(page.getByRole('heading', { name: '1. Dein Job-Daten-Schlüssel' })).toBeVisible();
    await page.getByRole('button', { name: 'Einrichtung überspringen' }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole('heading', { name: 'Meine Jobs' })).toBeVisible();

    await page.goto('/jobs/add');
    await page.getByRole('tab', { name: /Jobs importieren|^Import$/ }).click();
    await expect(page.getByRole('radio', { name: /Arbeitsagentur/ })).toBeChecked();
    await expect(page.getByText(/noch keinen JobHunter-Token/)).toBeVisible();
    await context.close();
  });
});

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'Phone only');

  test('the first-login steps and every page fit a phone screen', async ({ page }) => {
    await page.goto('/signup');
    await signUp(page, EN);
    await expect(page.getByText('Step 1 of 4 · Job data key')).toBeVisible();
    await page.getByRole('button', { name: 'Skip setup' }).click();
    await expect(page).toHaveURL(/\/jobs$/);

    for (const path of [
      '/jobs',
      '/jobs/add',
      '/tracker',
      '/resume',
      '/profile',
      '/settings',
      '/admin',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(wide, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    await expect(page.getByRole('navigation', { name: TABS })).toBeVisible();
  });
});
