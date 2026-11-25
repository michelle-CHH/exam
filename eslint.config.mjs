import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      sonarjs,
    },
    rules: {
      // 1. 函式複雜度、巢狀深度與型別異味（ESLint 內建）
      "complexity": ["warn", { max: 15 }],
      "max-depth": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // 2. SonarJS 程式碼異味規則（認知複雜度、重複條件與冗餘分支）
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-identical-conditions": "warn",
      "sonarjs/no-duplicated-branches": "warn",
      "sonarjs/no-collapsible-if": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // 排除測試與靜態分析產生的報告資料夾，避免 ESLint 誤掃描自動生成的 JS 檔
    "coverage/**",
    "vitest-html/**",
    "jscpd-report/**",
  ]),
]);

export default eslintConfig;