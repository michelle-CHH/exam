import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // text: 終端機顯示表格 | json-summary: 供 GitHub Actions 上傳留存 | html: 本機視覺化報告 | lcov: 供 SonarQube Cloud 通用
      reporter: ["text", "json-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    // 必須與 tsconfig.json 的 paths 保持一致
    alias: { "@": srcDir },
  },
});
