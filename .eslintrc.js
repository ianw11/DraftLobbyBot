module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 6
    },
    env: {
        node: true
    },
    plugins: [
      '@typescript-eslint',
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        'no-throw-literal': 2,
        indent: ["error", 4, {"SwitchCase": 1}]
    }
  };