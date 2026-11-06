import { bestLine, contentLines, mentionsTerm, readLine, splitLines } from './replyEdit';

/**
 * Where in the finished resume a missing keyword fits best, found word by word: every bullet is
 * compared with the sentences of the job ad that use the keyword, and the bullet sharing the most
 * words wins. No AI: it runs again as you edit, so it always looks at the resume as it is now.
 */

// Small words that say nothing about the work, in English and German.
const STOP = new Set(
  `and the for with you your our are was were will this that from into have has had who what
  when where which their they them its not but all any can our out use using used able also
  more most such than then there these those very well work working team teams role job
  years year experience strong good great new about over other each both own via etc
  und der die das den dem des mit für von ein eine einer eines einem einen ist sind wir ihr
  ihre ihren sie bei auf aus als auch oder sowie zur zum nach über unter sich wie was wird
  werden haben hast hat dass durch gute guten sehr mehr jahre jahren erfahrung team aufgaben`
    .split(/\s+/)
    .filter(Boolean),
);

/** A rough stem, so "containers" meets "container" and "deployed" meets "deploying". */
const stem = (word: string) =>
  word.length > 5 ? word.replace(/(?:ing|ed|es|s|en|er|ung)$/u, '') : word;

/** The meaningful words of a text, each with its stem. */
function wordsOf(text: string): { word: string; stem: string }[] {
  const found = text.match(/[\p{L}\p{N}][\p{L}\p{N}+#]*(?:[.-][\p{L}\p{N}]+)*/gu) ?? [];
  return found
    .filter((word) => word.length > 2 && !STOP.has(word.toLowerCase()))
    .map((word) => ({ word, stem: stem(word.toLowerCase()) }));
}

/** The stems of the ad's sentences that use the term, without the term's own words. */
export function adContext(ad: string, term: string): Set<string> {
  const own = new Set(wordsOf(term).map((w) => w.stem));
  const sentences = ad.split(/(?<=[.!?;:])\s+|\n+/u).filter((s) => mentionsTerm(s, term));
  return new Set(
    sentences.flatMap((s) => wordsOf(s).map((w) => w.stem)).filter((s) => !own.has(s)),
  );
}

export interface KeywordPlace {
  /** The line of the resume. */
  line: number;
  /** The words that line shares with the ad around the keyword (or the related skill). */
  words: string[];
}

/** How well each candidate line fits: shared words, plus extra for the related skill. */
function scoreLines(resume: string, term: string, ad: string, related: string | null) {
  const lines = splitLines(resume);
  const bullets = contentLines(resume).filter((i) => readLine(lines[i] ?? '').kind === 'bullet');
  const candidates = bullets.length ? bullets : contentLines(resume);
  const context = adContext(ad, term);
  return candidates.map((i) => {
    const text = readLine(lines[i] ?? '').text;
    const words: string[] = [];
    const stems = new Set<string>();
    for (const w of wordsOf(text)) {
      if (context.has(w.stem) && !stems.has(w.stem)) {
        stems.add(w.stem);
        words.push(w.word);
      }
    }
    const hasRelated = related !== null && mentionsTerm(text, related);
    if (hasRelated && !words.some((w) => w.toLowerCase() === related.toLowerCase())) {
      words.unshift(related);
    }
    return { line: i, words: words.slice(0, 5), score: words.length + (hasRelated ? 2 : 0) };
  });
}

/**
 * Up to 3 resume lines a keyword fits, best first: the bullets sharing the most words with the
 * ad's sentences about it; a bullet naming the related skill counts extra. Empty when no line
 * shares a word.
 */
export function placesFor(
  resume: string,
  term: string,
  ad: string,
  related: string | null = null,
): KeywordPlace[] {
  return scoreLines(resume, term, ad, related)
    .filter((place) => place.score > 0)
    .sort((a, b) => b.score - a.score || a.line - b.line)
    .slice(0, 3)
    .map(({ line, words }) => ({ line, words }));
}

/** The line a keyword fits best; with no shared word, the old guess (related skill, else first). */
export function placeFor(
  resume: string,
  term: string,
  ad: string,
  related: string | null = null,
): KeywordPlace {
  return placesFor(resume, term, ad, related)[0] ?? { line: bestLine(resume, related), words: [] };
}

// Short forms people write for a keyword, by the keyword written without spaces or marks.
const SHORT_FORMS: Record<string, string[]> = {
  kubernetes: ['k8s', 'kube'],
  javascript: ['js', 'ecmascript', 'es6'],
  typescript: ['ts'],
  postgresql: ['postgres', 'psql'],
  continuousintegration: ['ci'],
  cicd: ['ci', 'cd'],
  amazonwebservices: ['aws'],
  googlecloudplatform: ['gcp'],
  googlecloud: ['gcp'],
  microsoftazure: ['azure'],
  machinelearning: ['ml'],
  artificialintelligence: ['ai'],
  userexperience: ['ux'],
  userinterface: ['ui'],
  testdrivendevelopment: ['tdd'],
  reactnative: ['rn'],
  terraform: ['tf'],
  elasticsearch: ['elastic'],
};

const flat = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}+#]/gu, '');

/** How many letters must change to turn a into b (stops early past `max`). */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost);
    }
    if (Math.min(...next) > max) return max + 1;
    row = next;
  }
  return row[b.length] ?? max + 1;
}

/**
 * A word (or words) of the resume that is the keyword in another spelling or a short form:
 * "Kubernets" or "K8s" for Kubernetes, "Javascript" is already the same word. Null when the resume
 * has none, or already names the keyword. Words that only look alike (Java, JavaScript) don't count.
 */
export function closeSpelling(resume: string, term: string): string | null {
  if (mentionsTerm(resume, term)) return null;
  const target = flat(term);
  if (target.length < 2) return null;
  const size = term.trim().split(/\s+/).length;
  const tokens = resume.match(/[\p{L}\p{N}][\p{L}\p{N}+#./-]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu) ?? [];
  const shorts = SHORT_FORMS[target] ?? [];
  const max = target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0;
  for (let n = size; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + n).join(' ');
      const word = flat(phrase);
      if (n === 1 && shorts.includes(word)) return phrase;
      if (max === 0 || word.length < 4 || word === target) continue;
      // A longer or shorter word that only starts the same is another thing (Java, JavaScript).
      if (target.startsWith(word) || word.startsWith(target)) continue;
      if (distance(word, target, max) <= max) return phrase;
    }
  }
  return null;
}
