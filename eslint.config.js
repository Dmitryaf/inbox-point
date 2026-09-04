import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['.ai-rules/**', '.local/**', 'coverage/**', 'dist/**'],
  },
  {
    files: [
      'frontend/legacy/src/**/*.{ts,tsx}',
      'src/**/*.ts',
      'frontend/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
    ],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ['error', 'all'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*'],
              message: 'Use the @/* alias for cross-directory imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}', 'tests/frontend/**/*.{ts,tsx}'],
    rules: {
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: [
      'src/modules/content-management/**/*.ts',
      'src/modules/operations-monitoring/**/*.ts',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['frontend/src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@frontend/entities/**',
            '@frontend/features/**',
            '@frontend/widgets/**',
            '@frontend/pages/**',
            '@frontend/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@frontend/features/**',
            '@frontend/widgets/**',
            '@frontend/pages/**',
            '@frontend/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@frontend/widgets/**',
            '@frontend/pages/**',
            '@frontend/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@frontend/pages/**', '@frontend/app/**'] },
      ],
    },
  },
  {
    files: ['frontend/src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@frontend/app/**'] }],
    },
  },
  {
    files: ['src/modules/content-management/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@/modules/content-management/infrastructure/**',
            '@/modules/content-management/presentation/**',
            '@/modules/content-management/security/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/content-management/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@/modules/content-management/presentation/**',
            '@/modules/content-management/security/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/content-management/security/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@/modules/content-management/infrastructure/**',
            '@/modules/content-management/presentation/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/operations-monitoring/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@/modules/operations-monitoring/presentation/**',
            '@/modules/operations-monitoring/security/**',
          ],
        },
      ],
    },
  },

  {
    files: ['frontend/src/**/*.tsx'],
    rules: {
      curly: ['error', 'all'],
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
    },
  },
);
