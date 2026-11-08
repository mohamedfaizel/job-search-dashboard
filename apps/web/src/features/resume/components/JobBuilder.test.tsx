import type { BuilderDoc } from '@jobsearch/data';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { router } from '../../../test/navigation';
import { renderWithData } from '../../profile/test/render';
import { api, PROFILE, requests, server } from '../../profile/test/server';
import { achievementLines, addBullet, addSkill, docText, mentions } from '../docOps';
import { withKeyword } from '../keywordDrag';
import { ResumeBuilderPage } from '../ResumeBuilderPage';
import { DOC, jobBuild, jobBuilderHandlers } from '../test/server';

const SAVE_WAIT = { timeout: 3000 };

/** jsdom has no DataTransfer; the drag only needs these. */
const dataTransfer = (data: Record<string, string> = {}) => ({
  effectAllowed: '',
  types: Object.keys(data),
  getData: (type: string) => data[type] ?? '',
  setData: vi.fn(),
  setDragImage: vi.fn(),
});

function renderJob(query = '?job=j1') {
  window.history.pushState({}, '', `/resume${query}`);
  server.use(...jobBuilderHandlers);
  const user = userEvent.setup();
  renderWithData(<ResumeBuilderPage />);
  return user;
}

const card = (title: string) => screen.getByRole('region', { name: title });
const saves = () => requests.filter((r) => r.operation === 'SaveJobResumeBuild');
const lastSavedDoc = () => JSON.parse(saves().at(-1)?.variables['doc'] as string) as BuilderDoc;

describe('Resume for one job', () => {
  it('offers to start a copy from your master resume first', async () => {
    const user = renderJob();
    expect(await screen.findByText(/no resume for this job yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My master resume' })).toHaveAttribute(
      'href',
      '/resume',
    );
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start a copy for this job' }));
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Ada Lovelace');
    expect(requests).toContainEqual({
      operation: 'StartJobResumeBuild',
      variables: { jobId: 'j1' },
    });
    expect(screen.getByText(/For the job: Frontend Engineer at Acme GmbH/)).toBeInTheDocument();
    // No language switch and no "read again": this is a copy, not a master.
    expect(screen.queryByRole('combobox', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByText('Read my resume into sections again')).not.toBeInTheDocument();
  });

  it('saves edits to the job copy, not the master', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    const user = renderJob();
    const bullet = await screen.findByRole('textbox', { name: 'Bullet 2' });
    await user.clear(bullet);
    await user.type(bullet, 'Built the React design system');
    await waitFor(() => {
      expect(lastSavedDoc().sections[1]?.blocks[0]).toMatchObject({
        bullets: ['Cut load time by 40%', 'Built the React design system'],
      });
    }, SAVE_WAIT);
    expect(requests.some((r) => r.operation === 'SaveResumeBuild')).toBe(false);
    expect(await screen.findByText('✓ Saved')).toBeInTheDocument();
    await waitFor(() => {
      expect(requests.some((r) => r.operation === 'JobResumePdf')).toBe(true);
    });
    expect(screen.getByRole('link', { name: /PDF/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/resume-builder\/job\/j1\/resume\.pdf\?download=1$/),
    );
  });

  it('shows what the job asks for, and lets you tick, drag and add', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    const user = renderJob('?job=j1&tab=match');
    const panel = await screen.findByRole('region', { name: 'Job match' });
    expect(
      await within(panel).findByRole('status', { name: 'Fit score of the saved copy' }),
    ).toHaveTextContent('61%');
    // Nothing in this resume mentions any of the four terms yet.
    expect(within(panel).getByText('0 of 4 covered')).toBeInTheDocument();
    expect(within(panel).getByText('Missing')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'I have graphql' }));
    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'j1', term: 'graphql', have: true, keyword: false },
    });
    // Ticked: it is yours now and can go on a line.
    const chip = (await within(panel).findByText('graphql')).closest('li') as HTMLElement;
    expect(within(panel).getByText('You have it, not in the resume')).toBeInTheDocument();

    // Drag it onto a bullet: it is added after the line.
    const bullet = screen.getByRole('textbox', { name: 'Bullet 2' });
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    fireEvent.dragOver(bullet.closest('li') as HTMLElement, {
      dataTransfer: dataTransfer({ 'application/x-job-keyword': 'graphql' }),
    });
    fireEvent.drop(bullet.closest('li') as HTMLElement, {
      dataTransfer: dataTransfer({ 'application/x-job-keyword': 'graphql' }),
    });
    expect(bullet).toHaveValue('Built the design system (graphql)');
    // Now the resume names it: it moves to "In your resume".
    await waitFor(() => {
      expect(within(panel).getByText('1 of 4 covered')).toBeInTheDocument();
    });
    expect(within(panel).queryByText('You have it, not in the resume')).not.toBeInTheDocument();
    expect(within(panel).getByText('In your resume')).toBeInTheDocument();

    // Tick another and add it to Skills: a Skills section is made for it.
    await user.click(within(panel).getByRole('button', { name: 'I have figma' }));
    await user.click(await within(panel).findByRole('button', { name: 'Add figma to Skills' }));
    expect(
      within(card('Skills'))
        .getAllByRole('textbox', { name: /Bullet/ })
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(['figma']);
    await waitFor(() => {
      expect(lastSavedDoc().sections.map((s) => s.title)).toContain('Skills');
    }, SAVE_WAIT);
  });

  it('adds a true line from your achievements to your latest job', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    const user = renderJob('?job=j1&tab=match');
    server.use(
      api.query('MyProfile', () =>
        HttpResponse.json({
          data: { myProfile: { ...PROFILE, achievements: '- Led 5 engineers on checkout' } },
        }),
      ),
    );
    const panel = await screen.findByRole('region', { name: 'Job match' });
    const add = await within(panel).findByRole('button', { name: /Add to your latest job: / });
    await user.click(add);
    await waitFor(() => {
      expect(
        within(card('Experience'))
          .getAllByRole('textbox', { name: /Bullet/ })
          .map((i) => (i as HTMLInputElement).value),
      ).toHaveLength(3);
    });
  });

  it('marks a changed section and copies it to the master', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    const user = renderJob();
    const bullet = await screen.findByRole('textbox', { name: 'Bullet 2' });
    expect(screen.queryByText(/Changed for this job/)).not.toBeInTheDocument();
    await user.type(bullet, '!');
    const button = await screen.findByRole('button', {
      name: 'Copy Experience to my master resume',
    });
    expect(button).toHaveTextContent('Changed for this job');
    // Saved first (the button waits for it), then copied.
    await waitFor(() => {
      expect(button).toBeEnabled();
    }, SAVE_WAIT);
    await user.click(button);
    expect(requests).toContainEqual({
      operation: 'CopySectionToMaster',
      variables: { jobId: 'j1', sectionId: 'exp' },
    });
    // The master now has it, so the section is no longer "changed".
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Copy Experience to my master resume' }),
      ).not.toBeInTheDocument();
    });
  });

  it('goes back to the master after you confirm', async () => {
    jobBuild.current = {
      ...jobBuild.current,
      hasCopy: true,
      doc: JSON.stringify({ ...DOC, name: 'Ada for this job' }),
    };
    const user = renderJob();
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Ada for this job');
    await user.click(screen.getByRole('button', { name: 'Back to my master' }));
    // A second click on cancel keeps the copy.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada for this job');

    await user.click(screen.getByRole('button', { name: 'Back to my master' }));
    await user.click(screen.getByRole('button', { name: 'Yes, reset' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada Lovelace');
    });
    expect(requests).toContainEqual({
      operation: 'ResetJobResumeBuild',
      variables: { jobId: 'j1' },
    });
  });

  it('keeps the Job match tab to a job’s resume and puts it in the address', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    const user = renderJob();
    await user.click(await screen.findByRole('tab', { name: 'Job match' }));
    expect(router.replace).toHaveBeenCalledWith('/resume?job=j1&tab=match');
  });
});

describe('job match helpers', () => {
  it('reads the words of the resume and finds a term as a word of its own', () => {
    const hidden: BuilderDoc = {
      ...DOC,
      sections: [
        ...DOC.sections,
        {
          id: 'h',
          title: 'Hobbies',
          hidden: true,
          blocks: [{ id: 'p', kind: 'paragraph', text: 'Rust' }],
        },
      ],
    };
    const text = docText(hidden);
    expect(text).toContain('Built the design system');
    // A hidden section is not in the PDF, so it does not count.
    expect(text).not.toContain('Rust');
    expect(mentions('I know C++ and Go.', 'go')).toBe(true);
    expect(mentions('Google tools', 'go')).toBe(false);
    expect(mentions('C++ and C#', 'c++')).toBe(true);
    expect(mentions('anything', '  ')).toBe(false);
  });

  it('adds a keyword to a skills line or after a sentence, once', () => {
    expect(withKeyword('Frontend: React, TypeScript', 'GraphQL')).toBe(
      'Frontend: React, TypeScript, GraphQL',
    );
    expect(withKeyword('Built the design system', 'GraphQL')).toBe(
      'Built the design system (GraphQL)',
    );
    expect(withKeyword('', 'GraphQL')).toBe('GraphQL');
    expect(withKeyword('Used graphql daily', 'GraphQL')).toBe('Used graphql daily');
  });

  it('adds skills and bullets without touching the rest', () => {
    const withSkills = addSkill(DOC, 'GraphQL', 'Skills');
    expect(withSkills.sections.at(-1)).toMatchObject({
      title: 'Skills',
      blocks: [{ kind: 'bullets', items: ['GraphQL'] }],
    });
    // An existing Skills list gets a new line; empty lines are dropped.
    const again = addSkill(withSkills, 'Figma', 'Skills');
    expect(again.sections.at(-1)?.blocks[0]).toMatchObject({ items: ['GraphQL', 'Figma'] });
    const bulleted = addBullet(DOC, 'Led 5 engineers');
    expect(bulleted.sections[1]?.blocks[0]).toMatchObject({
      bullets: ['Cut load time by 40%', 'Built the design system', 'Led 5 engineers'],
    });
    // Without any job, the first list that is not Languages takes it.
    const plain: BuilderDoc = {
      ...DOC,
      sections: [
        {
          id: 'l',
          title: 'Languages',
          hidden: false,
          blocks: [{ id: 'a', kind: 'bullets', items: ['English'] }],
        },
        {
          id: 's',
          title: 'Misc',
          hidden: false,
          blocks: [{ id: 'b', kind: 'bullets', items: ['Chess'] }],
        },
      ],
    };
    expect(addBullet(plain, 'Won 3 cups').sections[1]?.blocks[0]).toMatchObject({
      items: ['Chess', 'Won 3 cups'],
    });
    expect(addBullet({ ...DOC, sections: [] }, 'x').sections).toEqual([]);
    expect(achievementLines('- Led 5 engineers\n\n• Cut cost 20%\nplain line')).toEqual([
      'Led 5 engineers',
      'Cut cost 20%',
      'plain line',
    ]);
  });
});
