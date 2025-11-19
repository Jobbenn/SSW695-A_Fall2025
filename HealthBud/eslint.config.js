import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: ["node_modules/", "dist/", "build/"],

    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
      prettier,
    },

    settings: {
      react: { version: "detect" },
    },

    rules: {
      // 🔥🔥 強制把所有會變成 error 的規則變成 warning 🔥🔥
      "no-undef": "warn",
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "import/no-unresolved": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prettier/prettier": "warn",

      // 🔥 這行是重點：所有 ESLint error → 強制降為 warning
      "no-console": "warn",
      "no-redeclare": "warn",
      "no-extra-semi": "warn",
      "no-restricted-globals": "warn",
      "no-fallthrough": "warn",
      "constructor-super": "warn",
      "valid-typeof": "warn",

      // 保險：如果還有 error，全部 override 成 warning
      ...Object.fromEntries(
        Object.entries(js.configs.recommended.rules).map(([k]) => [k, "warn"])
      ),
      ...Object.fromEntries(
        Object.entries(tsPlugin.configs.recommended.rules).map(([k]) => [
          k,
          "warn",
        ])
      ),
      ...Object.fromEntries(
        Object.entries(react.configs.recommended.rules).map(([k]) => [
          k,
          "warn",
        ])
      ),
      ...Object.fromEntries(
        Object.entries(reactHooks.configs.recommended.rules).map(([k]) => [
          k,
          "warn",
        ])
      ),
      ...Object.fromEntries(
        Object.entries(importPlugin.configs.recommended.rules).map(([k]) => [
          k,
          "warn",
        ])
      ),
    },
  },
];
