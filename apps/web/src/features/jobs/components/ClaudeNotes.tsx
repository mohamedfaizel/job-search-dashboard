import { useTranslations } from 'next-intl';
import { checkSections } from '../reply';

/** Sections Claude asks you about: shown open, as a short to-do list. */
const FOR_YOU = /stretch|ask me|frag|dehn/i;

/**
 * Claude's CHECK part of the reply: lines you may struggle to explain in an interview
 * (Stretches) and details it needs from you (Ask me) come first, as a to-do list; where it placed
 * your keywords and what it skipped or changed are folded away below.
 */
export function ClaudeNotes({ text }: { text: string }) {
  const t = useTranslations('Jobs.claudeNotes');
  const sections = checkSections(text);
  if (sections.length === 0) return null;
  const forYou = sections.filter((s) => FOR_YOU.test(s.label));
  const rest = sections.filter((s) => !FOR_YOU.test(s.label));
  const count = forYou.reduce((n, s) => n + s.items.length, 0);

  return (
    <section
      aria-label={t('title')}
      className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
    >
      <h3 className="text-sm font-semibold text-amber-950">
        {count > 0 ? t('titleCount', { count }) : t('title')}
      </h3>
      {count > 0 && <p className="text-xs text-amber-900">{t('intro')}</p>}
      {forYou.map((section) => (
        <div key={section.label} className="space-y-1">
          <h4 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
            {section.label}
          </h4>
          <ul
            className="list-disc space-y-1 pl-5 text-sm text-slate-800"
            aria-label={section.label}
          >
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {rest.length > 0 && (
        <details className="text-xs text-slate-700">
          <summary className="cursor-pointer text-amber-900">{t('more')}</summary>
          <div className="mt-1.5 space-y-1.5">
            {rest.map((section) => (
              <div key={section.label}>
                <span className="font-semibold">{section.label}: </span>
                {section.items.join(' · ')}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
