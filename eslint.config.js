import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import reactHooks from 'eslint-plugin-react-hooks';

const crossDirectoryImportPattern = {
  group: ['../*', '../../*', '../../../*'],
  message: 'Use the configured alias for cross-directory imports.',
};

function restrictedImports(...patterns) {
  return [
    'error',
    {
      patterns: [
        crossDirectoryImportPattern,
        ...patterns.map((pattern) => ({ group: [pattern] })),
      ],
    },
  ];
}

export default tseslint.config(
  {
    ignores: ['.ai-rules/**', '.local/**', 'coverage/**', 'dist/**'],
  },
  {
    files: ['src/**/*.ts', 'frontend/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
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
      'no-restricted-imports': restrictedImports(),
    },
  },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['frontend/common/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(
        'vue',
        'vue/**',
        'vue-router',
        'react',
        'react/**',
        'react-dom',
        'react-dom/**',
        'react-router',
        'react-router/**',
        '@tanstack/react-query',
        '@frontend/**',
        '@frontend-styles/**',
      ),
    },
  },
  {
    files: ['frontend/react/**/*.{ts,tsx}', 'tests/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['frontend/src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ['error', 'all'],
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}', 'tests/{frontend,react}/**/*.{ts,tsx}'],
    rules: {
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'max-lines': [
        'error',
        { max: 140, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['frontend/{src,react}/shared/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@frontend/entities/**',
        '@frontend/features/**',
        '@frontend/widgets/**',
        '@frontend/pages/**',
        '@frontend/app/**',
      ),
    },
  },
  {
    files: ['frontend/{src,react}/entities/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@frontend/features/**',
        '@frontend/widgets/**',
        '@frontend/pages/**',
        '@frontend/app/**',
      ),
    },
  },
  {
    files: ['frontend/{src,react}/features/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@frontend/widgets/**',
        '@frontend/pages/**',
        '@frontend/app/**',
      ),
    },
  },
  {
    files: ['frontend/{src,react}/widgets/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@frontend/pages/**',
        '@frontend/app/**',
      ),
    },
  },
  {
    files: ['frontend/{src,react}/pages/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': restrictedImports('@frontend/app/**'),
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@/config/**',
        '@/infrastructure/**',
        '@/modules/**',
      ),
    },
  },
  {
    files: ['src/modules/*/model/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@/modules/*/application/**',
        '@/modules/*/infrastructure/**',
        '@/modules/*/presentation/**',
      ),
    },
  },
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(
        '@/modules/*/infrastructure/**',
        '@/modules/*/presentation/**',
      ),
    },
  },
  {
    files: ['src/modules/*/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports('@/modules/*/presentation/**'),
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports('@/modules/*/presentation/**'),
    },
  },
);
