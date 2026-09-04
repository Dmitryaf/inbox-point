import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['.ai-rules/**', '.local/**', 'coverage/**', 'dist/**'],
  },
  {
    files: [
      'frontend/src/**/*.{ts,tsx}',
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
    files: ['frontend/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@manage/**', '@ops/**'] },
      ],
    },
  },
  {
    files: ['frontend/manage/src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@manage/entities/**',
            '@manage/features/**',
            '@manage/widgets/**',
            '@manage/pages/**',
            '@manage/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/manage/src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@manage/features/**',
            '@manage/widgets/**',
            '@manage/pages/**',
            '@manage/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/manage/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@manage/widgets/**',
            '@manage/pages/**',
            '@manage/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/manage/src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@manage/pages/**', '@manage/app/**'] },
      ],
    },
  },
  {
    files: ['frontend/manage/src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@manage/app/**'] }],
    },
  },
  {
    files: ['frontend/ops/src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@ops/features/**',
            '@ops/widgets/**',
            '@ops/pages/**',
            '@ops/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/ops/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@ops/widgets/**', '@ops/pages/**', '@ops/app/**'] },
      ],
    },
  },
  {
    files: ['frontend/ops/src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@ops/pages/**', '@ops/app/**'] },
      ],
    },
  },
  {
    files: ['frontend/ops/src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@ops/app/**'] }],
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
    files: ['frontend/*/src/**/*.tsx'],
    rules: {
      curly: ['error', 'all'],
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
    },
  },
);
