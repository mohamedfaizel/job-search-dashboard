import type { NextConfig } from 'next';

const config: NextConfig = {
  // The shared data layer is TypeScript source, not a built package, so Next compiles it too.
  transpilePackages: ['@jobsearch/data'],
};

export default config;
