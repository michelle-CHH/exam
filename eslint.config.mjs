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
      // 1. 函式複雜度、巢狀深度與型別異味（全專案通用基準）
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
  // 針對 React 元件 (.tsx)：因 JSX 樹狀結構與畫面互動狀態較多，放寬行數與複雜度門檻，避免過度破碎化
  {
    files: ["**/*.tsx"],
    rules: {
      "complexity": ["warn", { max: 30 }],
      "sonarjs/cognitive-complexity": ["warn", 30],
      "max-lines-per-function": [
        "warn",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // 針對測試檔案與腳本：關閉函式行數限制（describe 區塊包含大量測試案例屬正常現象）
  {
    files: ["**/*.test.{ts,tsx}", "scripts/**"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // 排除測試與靜態分析產生的報告資料夾
    "coverage/**",
    "vitest-html/**",
    "jscpd-report/**",
  ]),
]);

export default eslintConfig;