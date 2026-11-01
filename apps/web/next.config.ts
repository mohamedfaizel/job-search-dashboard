import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  // The shared data layer is TypeScript source, not a built package, so Next compiles it too.
  transpilePackages: ['@jobsearch/data'],
};

// Points next-intl at src/i18n/request.ts, which picks the language for each request.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(config);
