import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly',
        console: 'readonly', navigator: 'readonly', FormData: 'readonly',
        URL: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        createImageBitmap: 'readonly', File: 'readonly',
        Notification: 'readonly', atob: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',   // React 17+ JSX transform
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Service worker runs in a Worker scope: expose `self` and related globals.
    files: ['src/sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        self: 'readonly', caches: 'readonly', clients: 'readonly',
        registration: 'readonly', pushManager: 'readonly',
      },
    },
  },
];
