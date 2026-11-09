import { splitList } from '../../lib/split-list';

const escape = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * The items of a comma list ("React, Kubernetes, SAP") that the resume text never mentions, as
 * whole words and ignoring case: "React" is found in "React.js" but "Go" is not found in "Google".
 * Empty when there is no resume text to compare with.
 */
export function notInResume(list: string, resumeText: string): string[] {
  if (!resumeText.trim()) return [];
  return splitList(list).filter(
    (item) =>
      !new RegExp(`(?<![\\p{L}\\p{N}])${escape(item)}(?![\\p{L}\\p{N}])`, 'iu').test(resumeText),
  );
}
