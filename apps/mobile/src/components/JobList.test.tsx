import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeApi, job, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { JobList, PAGE_SIZE } from './JobList';
import { LogOutButton } from './LogOutButton';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

afterEach(() => {
  jest.restoreAllMocks();
});

const jobs = [
  job({
    id: '1',
    title: 'Data Engineer',
    company: { id: 1, name: 'HelloFresh', logoUrl: null },
    city: 'Berlin',
    workplace: 'HYBRID',
    fitScore: 82,
    createdAt: '2026-11-08T09:00:00.000Z',
  }),
  job({ id: '2', title: 'BI Analyst', fitScore: null, createdAt: '2026-11-01T09:00:00.000Z' }),
];

function api(locale = 'en', total = jobs.length) {
  return fakeApi({
    Me: () => ({ data: { me: { ...user, locale } } }),
    // Your last visit: jobs added after it are New.
    StartJobsVisit: () => ({ data: { startJobsVisit: '2026-11-05T00:00:00.000Z' } }),
    JobsPage: (v) => ({
      data: { jobsPage: { items: jobs, total, page: 1, pageSize: v['pageSize'] } },
    }),
    LogOut: () => ({ data: { logOut: true } }),
  });
}

describe('JobList', () => {
  it('lists your jobs newest first with Fit % and a New badge', async () => {
    const calls = api();
    await renderApp(<JobList />);
    expect(await screen.findByText('Data Engineer')).toBeOnTheScreen();
    expect(screen.getByText('2 jobs')).toBeOnTheScreen();
    expect(screen.getByText('HelloFresh')).toBeOnTheScreen();
    expect(screen.getByText('Berlin · Hybrid')).toBeOnTheScreen();
    expect(screen.getByText('Fit 82%')).toBeOnTheScreen();
    expect(screen.getByText('Fit –')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getAllByText('New')).toHaveLength(1);
    });
    expect(calls).toContainEqual({
      operation: 'JobsPage',
      variables: { page: 1, pageSize: PAGE_SIZE, sort: { field: 'POSTED_AT', direction: 'DESC' } },
    });
  });

  it('shows more when you scroll to the end', async () => {
    const calls = api('en', 45);
    await renderApp(<JobList />);
    await fireEvent(await screen.findByText('Data Engineer'), 'onEndReached');
    await fireEvent(screen.getByTestId('job-list'), 'onEndReached');
    await waitFor(() => {
      expect(calls).toContainEqual(
        expect.objectContaining({
          operation: 'JobsPage',
          variables: expect.objectContaining({ pageSize: PAGE_SIZE * 2 }),
        }),
      );
    });
  });

  it('speaks your account’s language', async () => {
    api('de');
    await renderApp(<JobList />);
    expect(await screen.findByText('Fit 82 %')).toBeOnTheScreen();
    expect(screen.getByText('2 Stellen')).toBeOnTheScreen();
    expect(screen.getByText('Berlin · Hybrid')).toBeOnTheScreen();
  });

  it('explains an empty list', async () => {
    fakeApi({
      Me: () => ({ data: { me: user } }),
      StartJobsVisit: () => ({ data: { startJobsVisit: null } }),
      JobsPage: () => ({ data: { jobsPage: { items: [], total: 0, page: 1, pageSize: 30 } } }),
    });
    await renderApp(<JobList />);
    expect(await screen.findByText(/No jobs yet\. Add jobs on the website/)).toBeOnTheScreen();
  });

  it('opens a job when you tap it and shows its tracker status', async () => {
    fakeApi({
      Me: () => ({ data: { me: user } }),
      StartJobsVisit: () => ({ data: { startJobsVisit: null } }),
      JobsPage: () => ({
        data: {
          jobsPage: {
            items: [{ ...jobs[0], applicationStatus: 'APPLIED' }],
            total: 1,
            page: 1,
            pageSize: 30,
          },
        },
      }),
    });
    await renderApp(<JobList />);
    expect(await screen.findByText('Applied')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Data Engineer/ }));
    expect(router.push).toHaveBeenCalledWith('/job/1');
  });

  it('logs out and goes back to the login', async () => {
    const calls = api();
    await renderApp(<LogOutButton />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login');
    });
    expect(calls.map((c) => c.operation)).toContain('LogOut');
  });
});
