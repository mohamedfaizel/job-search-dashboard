import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../../dashboard/src/components/Badge';

const meta = {
  title: 'Dashboard/Badge',
  component: Badge,
  args: { children: 'react', tone: 'gray' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every colour the table uses, side by side. */
export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="gray">react</Badge>
      <Badge tone="red">Remote</Badge>
      <Badge tone="orange">Senior</Badge>
      <Badge tone="purple">Applied</Badge>
      <Badge tone="blue">linkedin</Badge>
      <Badge tone="green">$90k - $120k</Badge>
      <Badge tone="pink">Computer programming</Badge>
    </div>
  ),
};

/** Long values are cut off with an ellipsis; the full text shows on hover. */
export const Truncated: Story = {
  args: {
    title: 'Information technology and services consulting',
    children: 'Information technology and services consulting',
  },
};
