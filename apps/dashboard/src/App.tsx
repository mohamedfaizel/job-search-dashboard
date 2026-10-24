import { JOB_COLUMNS } from './columns';

export default function App() {
  return (
    <section aria-labelledby="job-posts-heading" className="space-y-4">
      <h1 id="job-posts-heading" className="text-xl font-semibold text-slate-900">
        Job posts
      </h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {JOB_COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={JOB_COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                No jobs yet. Data arrives once the API is connected.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
