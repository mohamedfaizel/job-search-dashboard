/** What a job ad says about German. */
export interface GermanRequirement {
  /** True when the ad is written in German or asks for German skills. */
  required: boolean;
  /** The level the ad names, e.g. "C1", or one read from its words. Null when it says nothing. */
  level: string | null;
  /** True when the level comes from words like "fließend" rather than a named level. */
  levelEstimated: boolean;
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
/**
 * Words that describe a level instead of naming it, strongest first: "sehr gut" must be read
 * before "gut". Roughly how German employers use them (CEFR: A1 lowest, C2 native-like).
 */
const LEVEL_WORDS: [RegExp, string][] = [
  [/mutterspra|native|muttersprachlich/i, 'C2'],
  [
    /verhandlungssicher|business[- ]fluent|business[- ]level|fluent|fließend|fliessend|excellent|hervorragend/i,
    'C1',
  ],
  [/sehr gute?|very good|proficient|proficiency/i, 'C1'],
  [/\bgute?\b|\bgood\b|solide|sicher/i, 'B2'],
  [/grundkenntnisse|erste kenntnisse|basic|basis/i, 'A2'],
];

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
  const named =
    asking.map((s) => LEVEL.exec(s)?.[1]).find(Boolean) ??
    sentences
      .filter((s) => GERMAN.test(s))
      .map((s) => LEVEL.exec(s)?.[1])
      .find(Boolean) ??
    null;
  // No level named: read it from how the ad describes the German it wants.
  const estimated = named
    ? null
    : (LEVEL_WORDS.find(([words]) => asking.some((s) => words.test(s)))?.[1] ?? null);
  const required = language === 'de' || asking.some((s) => !OPTIONAL.test(s));
  if (!required) return { required, level: null, levelEstimated: false };
  return { required, level: named ?? estimated, levelEstimated: !named && estimated !== null };
}
