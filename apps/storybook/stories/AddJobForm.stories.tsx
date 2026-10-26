import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AddJobForm } from '../../job-form/src/components/AddJobForm';

const meta = {
  title: 'Job form/AddJobForm',
  component: AddJobForm,
} satisfies Meta<typeof AddJobForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/**
 * A "play" function runs after the story renders, like a tiny test: here it submits the
 * empty form so the snapshot shows the validation messages.
 */
export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /save job/i }));
    await expect(await canvas.findByText(/job title is required/i)).toBeInTheDocument();
  },
};
