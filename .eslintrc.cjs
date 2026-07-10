/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { browser: true, es2021: true },
  ignorePatterns: ['dist-chrome/', 'dist-firefox/', 'node_modules/', 'build.mjs'],
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
};
