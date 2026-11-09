/** Jest with Expo's preset: runs the screens as React Native, without a phone. */
module.exports = {
  preset: 'jest-expo',
  // pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>: React
  // Native, Expo and our own data package ship untranspiled code that Jest must transform.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:(?:jest-)?react-native|@react-native(?:-community)?|expo(?:nent)?|@expo(?:nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|use-intl|@formatjs/.*|intl-messageformat|immer|react-redux|redux|reselect|@reduxjs/.*|@jobsearch/.*|graphql-request|@graphql-typed-document-node))',
  ],
  setupFiles: ['./jest.setup.js'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**'],
  coverageReporters: ['lcov', 'text-summary'],
};
