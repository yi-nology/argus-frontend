import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'

/**
 * Argus 前端 lint 门禁。
 * 纪律：视觉 token 单源是 src/theme/tokens.ts，这里用语法选择器把
 * 「裸色值」直接判错——颜色只能引用 t.color.* / CSS 变量。
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'src/.umi', 'src/.umi-production'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // react-hooks 的编译器规则（set-state-in-effect / refs）是给开了 React
      // Compiler 的代码库准备的；本仓是「effect 里手写 fetch + setState」的既定
      // 模式（无 react-query），这两条会把每个数据加载都判成错，属于噪音。
      // 保留有价值的经典规则：rules-of-hooks / exhaustive-deps。
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',

      // 类型纪律：数据层的 any 是既往事故源（列表点开 /tasks/undefined）。
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // 视觉纪律：TSX 不得出现裸色值（设计 token 单源）。
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message:
            '裸十六进制色值禁止：请用 theme/tokens 的 t.color.*（CSS 变量，自动跟随浅/深主题）。',
        },
        {
          selector: 'Literal[value=/^rgba?\\(/]',
          message: '裸 rgb()/rgba() 色值禁止：请用 theme/tokens 的 t.color.*。',
        },
        {
          selector: "CallExpression[callee.name='rgba']",
          message: '裸 rgba() 调用禁止：请用 theme/tokens 的 t.color.*。',
        },
      ],

      // 渲染错误不得吞掉：ErrorBoundary 里必须有 console.error 结构化留痕。
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
  {
    // tokens.ts 是唯一允许出现具体色值的文件（设计 token 事实源）。
    files: ['src/theme/tokens.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Node 侧门禁脚本：声明 node 全局，其余规则同源。
    files: ['scripts/**/*.mjs', 'eslint.config.js', '.umirc.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
)
