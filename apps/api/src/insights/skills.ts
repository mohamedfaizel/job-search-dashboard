/**
 * Other ways people write a skill. JobsPipe tags use one spelling ("node.js"); resumes use many
 * ("NodeJS", "Node"). Add a line here when a skill you have shows up as missing.
 */
const ALIASES: Record<string, string[]> = {
  'node.js': ['nodejs', 'node'],
  react: ['reactjs', 'react.js'],
  'vue.js': ['vue', 'vuejs'],
  angular: ['angularjs'],
  'next.js': ['nextjs'],
  'nest.js': ['nestjs'],
  nestjs: ['nest.js'],
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  postgresql: ['postgres', 'psql'],
  kubernetes: ['k8s'],
  go: ['golang'],
  'c#': ['csharp'],
  'ci-cd': ['ci/cd', 'continuous integration'],
  graphql: ['graph ql'],
  aws: ['amazon web services'],
  gcp: ['google cloud'],
};

/** Every spelling we accept for a skill tag: "ci-cd" → "ci-cd", "ci cd", "ci/cd", … */
export function spellings(skill: string): string[] {
  const name = skill.toLowerCase().trim();
  const variants = new Set([name, name.replace(/-/g, ' '), ...(ALIASES[name] ?? [])]);
  return [...variants];
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when the text mentions the skill as a whole word, in any accepted spelling. "java" must
 * not match inside "javascript", and "c" must not match inside "c++".
 */
export function mentions(text: string, skill: string): boolean {
  const lower = text.toLowerCase();
  return spellings(skill).some((spelling) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escape(spelling)}(?![\\p{L}\\p{N}+#])`, 'u').test(lower),
  );
}
