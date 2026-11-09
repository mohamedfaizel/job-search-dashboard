/**
 * Ready-to-say salary scripts, filled with your numbers. They are written in the ad's language
 * (a German ad gets German scripts in the polite "Sie" form), whatever language the app is in,
 * like the resume and the interview prep.
 */

export type ScriptId = 'expectation' | 'counter' | 'extras';

export interface ScriptInput {
  /** The ad's language: "de" gets German scripts, anything else English. */
  language: string | null;
  currency: string;
  title: string;
  company: string;
  ask: number;
  /** Their offer, when you have one. */
  offer: number | null;
}

/** "€76,000" / "76.000 €": whole amounts in the script's language. */
export function money(amount: number, currency: string, language: string | null): string {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A signing bonus worth asking for: the gap to your ask, or 5% of it; at least 1,000. */
export function bonusFor(ask: number, offer: number | null): number {
  const gap = offer !== null && offer < ask ? ask - offer : ask * 0.05;
  return Math.max(1000, Math.round(gap / 1000) * 1000);
}

/** "Data Analyst (m/w/d)" → "Data Analyst": the gender tag belongs in ads, not in speech. */
export const spokenTitle = (title: string) =>
  title.replaceAll(/\s*\((?:[mwfdx*]\s*\/\s*){1,3}[mwfdx*]\)/gi, '').trim();

export function salaryScripts(input: ScriptInput): Record<ScriptId, string> {
  const title = spokenTitle(input.title);
  const m = (n: number) => money(n, input.currency, input.language);
  const ask = m(input.ask);
  const bonus = m(bonusFor(input.ask, input.offer));
  if (input.language === 'de') {
    const offer = input.offer !== null ? ` über ${m(input.offer)}` : '';
    return {
      expectation: `Für die Stelle als ${title} liegt meine Gehaltsvorstellung bei etwa ${ask} brutto im Jahr. Das beruht auf meiner Recherche zu vergleichbaren Stellen und auf meiner Erfahrung. Beim Gesamtpaket bin ich flexibel, und mich interessiert auch, welchen Rahmen Sie für die Stelle vorgesehen haben.`,
      counter: `Vielen Dank für Ihr Angebot${offer}, ich freue mich sehr auf die Arbeit bei ${input.company}. Nach meiner Recherche zu vergleichbaren Stellen und mit meiner Erfahrung hatte ich mit ${ask} gerechnet. Können wir uns diesem Betrag annähern? Dann sage ich gern zu.`,
      extras: `Falls beim Grundgehalt kein Spielraum ist: Können wir über andere Teile des Pakets sprechen? Zum Beispiel eine Antrittsprämie von ${bonus}, ein Gehaltsgespräch nach sechs Monaten, einen zusätzlichen Homeoffice-Tag pro Woche oder ein jährliches Weiterbildungsbudget.`,
    };
  }
  const offer = input.offer !== null ? ` of ${m(input.offer)}` : '';
  return {
    expectation: `For the ${title} role, I'm looking for a yearly salary of around ${ask}. That is based on my research into similar roles and on my experience. I'm flexible on the whole package, and I'd also like to hear the range you have in mind for this role.`,
    counter: `Thank you for the offer${offer}, I'm really excited about joining ${input.company}. Based on what similar roles pay and what I bring, I was hoping for ${ask}. Can we get closer to that number? If we can, I'm ready to say yes.`,
    extras: `If the base salary can't move, could we look at other parts of the package? For example a signing bonus of ${bonus}, a salary review after six months, an extra remote day per week, or a yearly learning budget.`,
  };
}
