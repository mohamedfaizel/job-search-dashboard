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

/**
 * Skills that usually come together: the job's term on the left, what makes it a fair addition
 * on the right ("apollo" fits a resume that has "graphql"). Only a hint for you and for the
 * prompt; the score still counts only words that are really in the resume.
 */
const RELATED: Record<string, string[]> = {
  apollo: ['graphql'],
  'apollo client': ['graphql'],
  relay: ['graphql', 'react'],
  urql: ['graphql'],
  'next.js': ['react'],
  remix: ['react'],
  redux: ['react'],
  'react native': ['react'],
  jest: ['javascript', 'typescript', 'unit testing'],
  vitest: ['jest', 'vite', 'unit testing'],
  'testing library': ['react', 'jest'],
  cypress: ['playwright', 'selenium', 'e2e'],
  playwright: ['cypress', 'selenium', 'e2e'],
  storybook: ['react', 'design system'],
  vite: ['webpack'],
  webpack: ['vite'],
  'module federation': ['microfrontends', 'webpack'],
  microfrontends: ['module federation'],
  'micro frontends': ['module federation', 'microfrontends'],
  tailwind: ['css'],
  sass: ['css'],
  'styled-components': ['css', 'react'],
  'nest.js': ['node.js', 'typescript'],
  nestjs: ['node.js', 'typescript'],
  express: ['node.js'],
  prisma: ['postgresql', 'typescript'],
  typeorm: ['postgresql', 'typescript'],
  postgresql: ['sql', 'mysql'],
  mysql: ['sql', 'postgresql'],
  kubernetes: ['docker'],
  helm: ['kubernetes'],
  terraform: ['aws', 'gcp', 'azure'],
  'github actions': ['ci-cd', 'gitlab ci'],
  'gitlab ci': ['ci-cd', 'github actions'],
  'ci-cd': ['github actions', 'gitlab ci', 'jenkins'],
  vue: ['react', 'angular'],
  nuxt: ['vue.js'],
  kotlin: ['java'],
  scala: ['java'],
};

/**
 * The skill in your resume (or your profile's Skills) that makes a missing term a fair addition,
 * e.g. "graphql" for "apollo". Null when nothing related is there.
 */
export function relatedTo(term: string, text: string): string | null {
  return (RELATED[term.toLowerCase()] ?? []).find((skill) => mentions(text, skill)) ?? null;
}

/** Every skill name we know (aliases and related skills), so keywords that are tools rank first. */
export const KNOWN_SKILLS: ReadonlySet<string> = new Set(
  [ALIASES, RELATED].flatMap((map) => Object.entries(map).flat(2)),
);
