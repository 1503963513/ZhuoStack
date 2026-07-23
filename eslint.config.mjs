import eslint from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,tsx}'];
const typescriptFiles = ['**/*.{ts,tsx}'];
const typescriptRecommended = typescriptEslint.configs['flat/recommended'].map((config) => ({
  ...config,
  files: typescriptFiles,
}));

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'apps/api/prisma/schema.active/**',
    ],
  },
  {
    ...eslint.configs.recommended,
    files: sourceFiles,
  },
  ...typescriptRecommended,
  prettier,
  {
    files: typescriptFiles,
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
