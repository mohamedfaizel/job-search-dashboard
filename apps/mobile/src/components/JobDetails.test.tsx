import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { fakeApi, job, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { JobDetails } from './JobDetails';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

afterEach(() => {
  jest.restoreAllMocks();
});

const ad = job({
  id: '7',
  title: 'Data Engineer',
  company: { id: 3, name: 'HelloFresh', logoUrl: null },
  city: 'Berlin',
  workplace: 'REMOTE',
  fitScore: 64,
  url: 'https://jobs.example.com/7',
  salaryMinUsd: 90000,
  salaryMaxUsd: 120000,
  skills: ['SQL', 'Python'],
  description: 'We build data pipelines.',
  applicationStatus: 'SAVED',
});

/** The fake API; `failMove` makes the status change fail with that message. */
function api(over: Partial<typeof ad> = {}, failMove?: string) {
  return fakeApi({
    Me: () => ({ data: { me: user } }),
    Job: () => ({ data: { job: { ...ad, ...over } } }),
    UpdateJobStatus: (v) =>
      failMove
        ? { errors: [{ message: failMove }] }
        : { data: { updateJobStatus: { id: v['id'], applicationStatus: v['status'] } } },
  });
}

describe('JobDetails', () => {
  it('shows the job like the website popup', async () => {
    api();
    await renderApp(<JobDetails id="7" />);
    expect(await screen.findByRole('header', { name: 'Data Engineer' })).toBeOnTheScreen();
    expect(screen.getByText('HelloFresh')).toBeOnTheScreen();
    expect(screen.getByText('Berlin · Remote')).toBeOnTheScreen();
    expect(screen.getByText('Fit 64%')).toBeOnTheScreen();
    expect(screen.getByText('Salary: $90,000 – $120,000')).toBeOnTheScreen();
    expect(screen.getByText('Skills: SQL, Python')).toBeOnTheScreen();
    expect(screen.getByText('We build data pipelines.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Saved' })).toBeChecked();
  });

  it('opens the ad in the browser', async () => {
    api();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderApp(<JobDetails id="7" />);
    await fireEvent.press(await screen.findByRole('link', { name: 'Open the job ad ↗' }));
    expect(open).toHaveBeenCalledWith('https://jobs.example.com/7');
  });

  it('moves the job on your tracker', async () => {
    const calls = api();
    await renderApp(<JobDetails id="7" />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Applied' }));
    await waitFor(() => {
      expect(calls).toContainEqual({
        operation: 'UpdateJobStatus',
        variables: { id: '7', status: 'APPLIED' },
      });
    });
  });

  it('says when the move failed', async () => {
    api({}, 'Job 7 was not found.');
    await renderApp(<JobDetails id="7" />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Offer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Job 7 was not found/);
  });

  it('shows one end of the salary, no link and no ad text when the job has none', async () => {
    api({ salaryMinUsd: null, salaryMaxUsd: 80000, url: null, description: null, fitScore: null });
    await renderApp(<JobDetails id="7" />);
    expect(await screen.findByText('Salary: $80,000')).toBeOnTheScreen();
    expect(screen.getByText('This job has no ad text.')).toBeOnTheScreen();
    expect(screen.getByText('Fit –')).toBeOnTheScreen();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says when the job can’t be loaded', async () => {
    fakeApi({
      Me: () => ({ data: { me: user } }),
      Job: () => ({ errors: [{ message: 'Job 9 was not found.' }] }),
    });
    await renderApp(<JobDetails id="9" />);
    // The app asks once more before it gives up.
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      /Job 9 was not found/,
    );
  });
});
