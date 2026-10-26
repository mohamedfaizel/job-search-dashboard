import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyncPanel } from '../../job-form/src/components/SyncPanel';

const meta = {
  title: 'Job form/SyncPanel',
  component: SyncPanel,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SyncPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
