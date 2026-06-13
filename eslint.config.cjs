module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.wrangler/**',
      '.factory/**',
      '.agents/**',
    ],
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
    },
  },
];
