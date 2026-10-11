import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    sortImports: true,
    ignorePatterns: ["**/dist/**", "**/.devbox/**", "**/node_modules/**", "**/*.md"],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/.devbox/**", "**/node_modules/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["typescript", "vue"],
    categories: {
      correctness: "error",
    },
    rules: {
      "typescript/prefer-optional-chain": "error",
      "no-unused-vars": "error",
      "prefer-const": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-explicit-any": "warn",
      "typescript/no-non-null-assertion": "off",
      "unicorn/prefer-node-protocol": "off",
    },
    overrides: [
      {
        files: ["**/*.vue"],
        rules: {
          "no-unused-vars": "off",
        },
      },
    ],
  },
});
