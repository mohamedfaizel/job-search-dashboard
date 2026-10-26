import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import type { Preview } from '@storybook/react-vite';
import '../src/index.css';

const preview: Preview = {
  // Components that use the data hooks need the Redux store and the query cache around them.
  decorators: [
    (Story) => (
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <div className="p-4 font-sans">
          <Story />
        </div>
      </DataProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};

export default preview;
