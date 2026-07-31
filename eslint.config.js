// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const typescriptPaths = require('eslint-plugin-typescript-paths');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: {
      'typescript-paths': typescriptPaths,
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/prefer-for-of': 'off',
      semi: ['error', 'always'],
      'arrow-parens': ['off', 'always'],
      'no-underscore-dangle': 'off',
      'keyword-spacing': 'error',
      'object-curly-spacing': ['error', 'always'],
      'space-infix-ops': ['error'],
      'comma-spacing': ['error', { before: false, after: true }],
      'arrow-spacing': ['error', { before: true, after: true }],
      'space-before-blocks': ['error'],
      'typescript-paths/absolute-import': ['error', { enableAlias: true }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off',
    },
  },
]);
