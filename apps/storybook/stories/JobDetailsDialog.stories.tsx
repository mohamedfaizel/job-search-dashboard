import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { JobDetailsDialog } from '../../dashboard/src/components/JobDetailsDialog';
import { makeJob } from '../../dashboard/src/test/fixtures';

const DESCRIPTION = `About the role
We are looking for a Senior Frontend Engineer to build our customer dashboard.

What you will do
- Build accessible React components with TypeScript
- Work with designers on a shared component library
- Own features from the GraphQL schema to the UI

What we offer
Remote-first team, 30 days of holiday and a yearly learning budget.`;

const meta = {
  title: 'Dashboard/JobDetailsDialog',
  component: JobDetailsDialog,
  args: {
    job: makeJob({ description: DESCRIPTION, applicationStatus: 'SAVED' }),
    onClose: fn(),
    onStatusChange: fn(),
  },
  // The dialog covers the page, so give the snapshot room.
  parameters: { chromatic: { viewports: [1280] } },
} satisfies Meta<typeof JobDetailsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

/** Manually added jobs often have no salary, link or description. */
export const MinimalJob: Story = {
  args: {
    job: makeJob({
      source: 'MANUAL',
      url: null,
      description: null,
      salaryMinUsd: null,
      salaryMaxUsd: null,
      seniority: null,
      jobFunction: null,
      skills: [],
    }),
  },
};
