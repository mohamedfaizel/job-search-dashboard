import type {
  Job,
  JobFilterOptions,
  JobSortField,
  JobSortInput,
  JobsTableState,
  ListFilterKey,
} from '@jobsearch/data';
import { useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useIsPhone } from '../useIsPhone';
import { ColumnFilter } from './ColumnFilter';
import type { RowActions } from './columns';
import { COLUMN_CONTROLS, columns, features, RowActionsContext } from './columns';
import { JobCards } from './JobCards';
import { SortButton } from './SortButton';

export interface JobsTableProps extends RowActions {
  jobs: Job[];
  sort: JobSortInput | null;
  filters: JobsTableState['filters'];
  filterOptions: JobFilterOptions | undefined;
  onSort: (field: JobSortField) => void;
  onToggleFilter: (key: ListFilterKey, value: string) => void;
  onClearFilter: (key: ListFilterKey) => void;
  /** Dims the rows while a new page or sort is loading. */
  isFetching?: boolean;
  /** Columns switched off in the Columns menu, as { columnId: false }. */
  columnVisibility?: Record<string, boolean>;
  /** Ids of the ticked rows. */
  selected?: ReadonlySet<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

const NO_HIDDEN_COLUMNS: Record<string, boolean> = {};
const NO_SELECTION: ReadonlySet<string> = new Set();
const noop = () => undefined;

/**
 * The job posts table. It only displays what it is given and reports clicks; the
 * JobsDashboard container decides what data to fetch. That split makes it easy to
 * test and to show in Storybook.
 */
export function JobsTable({
  jobs,
  sort,
  filters,
  filterOptions,
  onSort,
  onToggleFilter,
  onClearFilter,
  openJob,
  setStatus,
  toggleHidden,
  showingHidden = false,
  newSince = null,
  isFetching = false,
  columnVisibility = NO_HIDDEN_COLUMNS,
  selected = NO_SELECTION,
  onSelectionChange = noop,
}: JobsTableProps) {
  const isPhone = useIsPhone();
  const table = useTable({
    features,
    columns,
    data: jobs,
    getRowId: (job) => job.id,
    state: { columnVisibility },
  });
  const actions = useMemo(() => {
    const allSelected = jobs.length > 0 && jobs.every((job) => selected.has(job.id));
    return {
      openJob,
      setStatus,
      toggleHidden,
      showingHidden,
      newSince,
      selected,
      allSelected,
      toggleSelected: (job: Job) => {
        const next = new Set(selected);
        if (!next.delete(job.id)) next.add(job.id);
        onSelectionChange(next);
      },
      toggleAll: () => {
        onSelectionChange(allSelected ? new Set() : new Set(jobs.map((job) => job.id)));
      },
    };
  }, [
    jobs,
    openJob,
    setStatus,
    toggleHidden,
    showingHidden,
    newSince,
    selected,
    onSelectionChange,
  ]);

  // Phones get a list of cards: a wide table is hard to read on a narrow screen.
  if (isPhone) {
    return (
      <RowActionsContext.Provider value={actions}>
        <JobCards jobs={jobs} isFetching={isFetching} />
      </RowActionsContext.Provider>
    );
  }

  return (
    <RowActionsContext.Provider value={actions}>
      {/* Scrolls inside its own box so the header can stick to the top while you scroll. */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-white/95 text-xs text-slate-500 shadow-[inset_0_-1px_0_var(--color-slate-200)] backdrop-blur">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const controls = COLUMN_CONTROLS[header.column.id] ?? {};
                  const direction =
                    controls.sortField && sort?.field === controls.sortField
                      ? sort.direction
                      : null;
                  const label = <table.FlexRender header={header} />;
                  const name = controls.filter?.label ?? String(header.column.columnDef.header);

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        direction === 'ASC'
                          ? 'ascending'
                          : direction === 'DESC'
                            ? 'descending'
                            : undefined
                      }
                      className="px-3 py-3 font-medium whitespace-nowrap first:w-10 first:pl-4"
                    >
                      <div className="flex items-center gap-1">
                        {controls.sortField ? (
                          <SortButton
                            direction={direction}
                            onClick={() => {
                              if (controls.sortField) onSort(controls.sortField);
                            }}
                          >
                            {label}
                          </SortButton>
                        ) : (
                          label
                        )}
                        {controls.filter && (
                          <ColumnFilter
                            column={name}
                            options={controls.filter.options(filterOptions)}
                            selected={filters[controls.filter.key] ?? []}
                            onToggle={(value) => {
                              if (controls.filter) onToggleFilter(controls.filter.key, value);
                            }}
                            onClear={() => {
                              if (controls.filter) onClearFilter(controls.filter.key);
                            }}
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-slate-100 transition-colors hover:bg-slate-50 ${
                  selected.has(row.id) ? 'bg-indigo-50/60' : ''
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 align-middle text-slate-700 first:pl-4">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RowActionsContext.Provider>
  );
}
