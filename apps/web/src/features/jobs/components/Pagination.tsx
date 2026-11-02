import { useTranslations } from 'next-intl';

const PAGE_SIZES = [10, 25, 50, 100];

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const t = useTranslations('Jobs.pagination');
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const button =
    'rounded border border-slate-200 bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav
      aria-label={t('label')}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"
    >
      <p>{t('showing', { first, last, total })}</p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          {t('rowsPerPage')}
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
            }}
            className="rounded border border-slate-200 bg-white px-1.5 py-1"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>{t('page', { page, pageCount })}</span>
        <button
          type="button"
          className={button}
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          {t('previous')}
        </button>
        <button
          type="button"
          className={button}
          disabled={page >= pageCount}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          {t('next')}
        </button>
      </div>
    </nav>
  );
}
