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
import { ColumnFilter } from './ColumnFilter';
import type { RowActions } from './columns';
import { COLUMN_CONTROLS, columns, features, RowActionsContext } from './columns';
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
}

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
  isFetching = false,
}: JobsTableProps) {
  const table = useTable({ features, columns, data: jobs, getRowId: (job) => job.id });
  const actions = useMemo(
    () => ({ openJob, setStatus, toggleHidden, showingHidden }),
    [openJob, setStatus, toggleHidden, showingHidden],
  );

  return (
    <RowActionsContext.Provider value={actions}>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-slate-50 text-slate-500">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const controls = COLUMN_CONTROLS[header.column.id] ?? {};
                  const direction =
                    controls.sortField && sort?.field === controls.sortField
                      ? sort.direction
                      : null;
                  const label = <table.FlexRender header={header} />;
                  const name = String(header.column.columnDef.header);

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
                      className="px-3 py-2.5 font-medium whitespace-nowrap"
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
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle text-slate-700">
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
