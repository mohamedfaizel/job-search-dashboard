/** What a job ad says about German. */
export interface GermanRequirement {
  /** True when the ad is written in German or asks for German skills. */
  required: boolean;
  /** The level the ad names, e.g. "C1". Null when it names none. */
  level: string | null;
}

const GERMAN = /deutsch|german/i;
const LEVEL = /\b([ABC][12])\b/;
/** Ways ads ask for German: "Deutschkenntnisse", "fließend Deutsch", "fluent German", … */
const ASKS = new RegExp(
  [
    'deutschkenntnisse',
    'deutsch\\w*\\s*(?:in wort und schrift|kenntnisse|sprachkenntnisse)',
    '(?:fließend|fliessend|verhandlungssicher|sehr gut|gut)\\w*\\s+deutsch',
    'deutsch\\s*(?:\\(|auf|-|–|:)?\\s*(?:niveau\\s*)?[abc][12]',
    'german\\s+(?:language\\s+)?(?:skills|is (?:a must|required|mandatory)|required|proficiency|fluency|speaker)',
    '(?:fluent|fluency|proficient|proficiency|business[- ]fluent|native)\\s+(?:in\\s+)?german',
    '(?:speak|speaks|speaking)\\s+german',
    'german\\s*\\(?\\s*[abc][12]',
    '[abc][12]\\s+(?:level\\s+)?(?:in\\s+)?(?:german|deutsch)',
  ].join('|'),
  'i',
);
/** "German is a plus" asks for nothing. */
const OPTIONAL =
  /\b(?:plus|nice[- ]to[- ]have|bonus|advantage|von vorteil|wünschenswert|wuenschenswert|optional)\b/i;

/**
 * Whether the job needs German, read from the ad with plain patterns (no AI). An ad written in
 * German needs it; an English ad needs it when a sentence asks for German and doesn't call it a
 * plus.
 */
export function germanRequirement(
  description: string | null,
  language: string | null,
): GermanRequirement {
  const sentences = (description ?? '').split(/(?<=[.!?;\n])\s+|\n/);
  const asking = sentences.filter((s) => ASKS.test(s));
  const level =
    asking.map((s) => LEVEL.exec(s)?.[1]).find(Boolean) ??
    sentences
      .filter((s) => GERMAN.test(s))
      .map((s) => LEVEL.exec(s)?.[1])
      .find(Boolean) ??
    null;
  const required = language === 'de' || asking.some((s) => !OPTIONAL.test(s));
  return { required, level: required ? level : null };
}
