import type { ApplicationStatus } from '@jobsearch/data';
import { APPLICATION_STATUSES } from '@jobsearch/data';
import { STATUS_LABELS } from '../format';

const TONE: Record<ApplicationStatus, string> = {
  NONE: 'text-slate-500',
  SAVED: 'text-sky-700',
  APPLIED: 'text-indigo-700',
  INTERVIEWING: 'text-amber-700',
  OFFER: 'text-emerald-700',
  REJECTED: 'text-red-700',
};

interface Props {
  value: ApplicationStatus;
  onChange: (status: ApplicationStatus) => void;
  /** Accessible name, e.g. "Status for Senior Engineer at Acme". */
  label: string;
  disabled?: boolean;
}

/** The manual "update status" control: track where you are with each job. */
export function StatusSelect({ value, onChange, label, disabled = false }: Props) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value as ApplicationStatus);
      }}
      onClick={(e) => {
        e.stopPropagation(); // don't open the job details when using the dropdown
      }}
      className={`rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium ${TONE[value]} disabled:opacity-50`}
    >
      {APPLICATION_STATUSES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
