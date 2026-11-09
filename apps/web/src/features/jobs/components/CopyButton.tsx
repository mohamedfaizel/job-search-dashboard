import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** A small Copy button for a text shown on the page, with "Copied" next to it. */
export function CopyButton({ text }: { text: string }) {
  const t = useTranslations('Jobs.copy');
  const [done, setDone] = useState<'yes' | 'failed' | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => {
              setDone('yes');
            },
            () => {
              setDone('failed');
            },
          );
        }}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {t('button')}
      </button>
      {done && (
        <span role="status" className="text-xs text-slate-500">
          {done === 'yes' ? t('done') : t('failedShort')}
        </span>
      )}
    </span>
  );
}
