'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
  /** An optional button on the toast, e.g. "Show". */
  action?: { label: string; onClick: () => void } | undefined;
}

type ShowToast = (text: string, options?: { tone?: ToastTone; action?: Toast['action'] }) => void;

/** How long a toast stays. Errors stay longer, so there is time to read them. */
const SHOW_MS = { success: 4000, info: 6000, error: 8000 } satisfies Record<ToastTone, number>;

// Without a provider (e.g. a component test) toasts are simply not shown.
const ToastContext = createContext<ShowToast>(() => undefined);

/** Shows a short message at the bottom of the screen: `toast('Saved')`. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const TONE = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-slate-300 bg-white text-slate-900',
} satisfies Record<ToastTone, string>;

// Older browsers (and the test DOM) have no popovers: there the toasts are a plain fixed box.
// The server can't know, so it says no and the browser decides after loading.
const hasPopover = () => 'showPopover' in HTMLElement.prototype;
const noSubscribe = () => () => undefined;
const useHasPopover = () => useSyncExternalStore(noSubscribe, hasPopover, () => false);

const ICON = { success: '✓', error: '!', info: '🔔' } satisfies Record<ToastTone, string>;

/**
 * Toasts: short messages after something happened ("Reply saved", "3 new jobs match"). They
 * stack at the bottom right (bottom on phones), go away by themselves and can be closed.
 * Screen readers hear them through a live region.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('Notifications');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const stack = useRef<HTMLDivElement>(null);
  const canPop = useHasPopover();

  // The job popup is a native <dialog>, drawn above everything else (the "top layer"). A
  // popover shown after it is drawn above it, so toasts stay visible over the popup.
  useEffect(() => {
    const el = stack.current;
    if (!el || !canPop) return;
    const open = el.matches(':popover-open');
    if (open) el.hidePopover();
    if (toasts.length) el.showPopover();
  }, [toasts, canPop]);

  const close = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (text, options = {}) => {
      const tone = options.tone ?? 'success';
      const id = nextId.current++;
      // At most three at once: the oldest goes first.
      setToasts((list) => [...list.slice(-2), { id, tone, text, action: options.action }]);
      setTimeout(() => {
        close(id);
      }, SHOW_MS[tone]);
    },
    [close],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={stack}
        popover={canPop ? 'manual' : undefined}
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-auto bottom-4 z-[60] m-0 flex flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg ${TONE[toast.tone]}`}
          >
            <span aria-hidden className="font-semibold">
              {ICON[toast.tone]}
            </span>
            <span className="flex-1">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  close(toast.id);
                }}
                className="font-medium underline"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => {
                close(toast.id);
              }}
              className="-mr-1 px-1 opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
