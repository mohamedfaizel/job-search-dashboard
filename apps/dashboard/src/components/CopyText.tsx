import { useState } from 'react';

interface Props {
  /** The button's words, e.g. "Copy prompt for Claude". */
  label: string;
  text: string;
  /** What to do with it once copied, e.g. "Paste it into Claude." */
  copiedHint: string;
  /** Name of the box that shows the text, for selecting it by hand. */
  boxLabel: string;
  primary?: boolean;
  children?: React.ReactNode;
}

/**
 * Copies a ready-made text to the clipboard. Clipboard access can be blocked, so the text is
 * also in a box below, to select by hand.
 */
export function CopyText({ label, text, copiedHint, boxLabel, primary = false, children }: Props) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
          className={
            primary
              ? 'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700'
              : 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
          }
        >
          {label}
        </button>
        {children}
        {copied && (
          <span role="status" className="text-sm text-slate-600">
            {copied === 'yes'
              ? `Copied. ${copiedHint}`
              : 'Could not copy. Select the text below instead.'}
          </span>
        )}
      </div>
      <details open={copied === 'failed'}>
        <summary className="cursor-pointer text-xs text-slate-500">Show the text</summary>
        <textarea
          readOnly
          value={text}
          aria-label={boxLabel}
          rows={8}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
      </details>
    </div>
  );
}
