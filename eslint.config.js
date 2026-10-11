import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_|^next$" }],
    },
  },
  {
    files: ["tests/**/*.js", "**/*.test.js"],
    languageOptions: {
      globals: { ...globals.jest, vi: "readonly" },
    },
  },
  { ignores: ["node_modules/", "prisma/migrations/"] },
];
