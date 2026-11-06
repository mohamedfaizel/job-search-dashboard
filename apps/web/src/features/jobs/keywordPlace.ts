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

/**
 * The resume line a keyword fits best: the bullet sharing the most words with the ad's sentences
 * about it; a bullet naming the related skill counts extra. With no shared word at all, the old
 * guess (the bullet naming the related skill, else the first).
 */
export function placeFor(
  resume: string,
  term: string,
  ad: string,
  related: string | null = null,
): KeywordPlace {
  const lines = splitLines(resume);
  const bullets = contentLines(resume).filter((i) => readLine(lines[i] ?? '').kind === 'bullet');
  const candidates = bullets.length ? bullets : contentLines(resume);
  const context = adContext(ad, term);
  let best: KeywordPlace | null = null;
  let bestScore = 0;
  for (const i of candidates) {
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
    const score = words.length + (hasRelated ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { line: i, words: words.slice(0, 5) };
    }
  }
  return best ?? { line: bestLine(resume, related), words: [] };
}
