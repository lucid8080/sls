import js from "@eslint/js";
import tseslint from "typescript-eslint";

const ignores = [
  ".next/**",
  "next-env.d.ts",
  "node_modules/**",
  "sls-bkup/**",
  "tools/wordpress-recovery/**",
  "content/**",
  "data/**",
  "reports/**",
  "sanitized-content-output/**",
  "formatted-content-output/**",
  "recovered-media-output/**",
  "route-output/**",
  "seo-output/**",
  "link-output/**",
];

const eslintConfig = [
  {
    ignores,
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
];

export default eslintConfig;
