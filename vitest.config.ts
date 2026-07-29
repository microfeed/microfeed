import {fileURLToPath} from "node:url";

import {defineConfig} from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    exclude: ["tests/worker/**", "node_modules/**", "dist/**"],
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
});
