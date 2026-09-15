import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
export default [
  { ignores:['dist/**','node_modules/**','data/**','test-results/**','playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files:['**/*.{js,jsx,ts,tsx}'],languageOptions:{globals:{...globals.browser,...globals.node}},rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]} },
  { files:['src/**/*.{jsx,tsx}'],plugins:{'react-hooks':reactHooks,'react-refresh':reactRefresh},rules:{'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn','react-refresh/only-export-components':'warn'} },
]
