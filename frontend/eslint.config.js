import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// 生产前端 ESLint（R16）：与 prototype/eslint.config.js 同为 flat config、同一风格；
// 在其基础上加 TypeScript、React Hooks 与 i18n 规则。
export default tseslint.config(
  // 生成物（npm run gen:api）不 lint
  { ignores: ['dist/', 'src/lib/api/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // R8：TSX 不得硬编码界面文案，一律经 t()（eslint-plugin-i18next）
    files: ['src/**/*.tsx'],
    ...i18next.configs['flat/recommended'],
    // jsx-only：JSX 文本节点 + 下列用户可见属性；其余属性（variant、htmlFor、autoComplete 等）为代码标识，不算文案
    rules: {
      'i18next/no-literal-string': [
        'error',
        { mode: 'jsx-only', 'jsx-attributes': { include: ['^aria-label$', '^aria-description$', '^title$', '^placeholder$', '^alt$', '^label$'] } },
      ],
    },
  },
  {
    // shadcn CLI 生成的组件源码：同文件导出 variants 常量属上游约定
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
);
