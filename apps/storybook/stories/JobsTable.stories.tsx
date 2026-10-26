import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { JobsTable } from '../../dashboard/src/components/JobsTable';
import { FILTER_OPTIONS, JOBS, makeJob } from '../../dashboard/src/test/fixtures';

const meta = {
  title: 'Dashboard/JobsTable',
  component: JobsTable,
  // fn() records each call, so you can see the clicks in the Actions panel.
  args: {
    jobs: JOBS,
    sort: null,
    filters: {},
    filterOptions: FILTER_OPTIONS,
    onSort: fn(),
    onToggleFilter: fn(),
    onClearFilter: fn(),
    openJob: fn(),
    setStatus: fn(),
  },
} satisfies Meta<typeof JobsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Sorted by salary (highest first) with a Remote filter on: the header icons change. */
export const SortedAndFiltered: Story = {
  args: {
    sort: { field: 'SALARY', direction: 'DESC' },
    filters: { workplaces: ['REMOTE'] },
    jobs: JOBS.slice(0, 1),
  },
};

/** Many skills and every application status, to check wrapping and badge colours. */
export const ManyRows: Story = {
  args: {
    jobs: (['NONE', 'SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'] as const).map(
      (status, i) =>
        makeJob({
          id: `job-${i}`,
          title: `Frontend Engineer ${i + 1}`,
          applicationStatus: status,
          skills: ['react', 'typescript', 'graphql', 'tailwind', 'vite', 'storybook'].slice(
            0,
            i + 1,
          ),
        }),
    ),
  },
};

/** Rows are dimmed while the next page or sort order loads. */
export const Fetching: Story = { args: { isFetching: true } };

export const Empty: Story = { args: { jobs: [] } };
