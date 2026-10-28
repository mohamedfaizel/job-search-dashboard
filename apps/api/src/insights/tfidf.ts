/**
 * TF-IDF ("term frequency × inverse document frequency") scores how typical a word is for one
 * document compared with a whole collection:
 * - TF: the word appears often in this job description.
 * - IDF: the word appears in few of the other descriptions.
 * Words like "team" are everywhere, so they score low; "kafka" in one ad scores high.
 */

/** How many documents contain each word. Build once per collection and reuse it. */
export interface DocumentFrequencies {
  documents: number;
  counts: Map<string, number>;
}

export function documentFrequencies(documents: string[][]): DocumentFrequencies {
  const counts = new Map<string, number>();
  for (const words of documents) {
    for (const word of new Set(words)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return { documents: documents.length, counts };
}

/** The document's words, highest score first. */
export function rankTerms(
  words: string[],
  frequencies: DocumentFrequencies,
): { term: string; score: number }[] {
  const termCounts = new Map<string, number>();
  for (const word of words) termCounts.set(word, (termCounts.get(word) ?? 0) + 1);
  const most = Math.max(1, ...termCounts.values());

  return [...termCounts]
    .map(([term, count]) => {
      const containing = frequencies.counts.get(term) ?? 0;
      // "Smoothed" IDF: never divides by zero, and a word in every document still counts a little.
      const idf = Math.log((1 + frequencies.documents) / (1 + containing)) + 1;
      return { term, score: (count / most) * idf };
    })
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
}
