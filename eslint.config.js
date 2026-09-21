import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist", "**/coverage", "**/node_modules", "**/public/mockServiceWorker.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[expression=true]",
          message:
            "Give effects a block body. An expression body returns its value as the cleanup, which crashes React in production builds.",
        },
      ],
    },
  },
  {
    files: ["**/*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    /* The Functions app runs in Node. */
    files: ["apps/api/**/*.{ts,mjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    /* e2e scripts run in Node and pass functions to the browser page. */
    files: ["e2e/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
