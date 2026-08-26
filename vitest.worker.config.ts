import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./tests/worker/fixture-worker.ts",
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: "worker-test-better-auth-secret-32-bytes",
          DEPLOYMENT_ENVIRONMENT: "production",
          MICROFEED_ADMIN_AUTH_MODE: "built-in",
          MICROFEED_ADMIN_PATH: "admin",
          TEST_MIGRATIONS: await readD1Migrations(
            path.join(root, "migrations"),
          ),
          UPLOAD_SIGNING_KEY: "worker-test-signing-key",
          WEBHOOK_SECRET_KEY: "worker-test-webhook-encryption-key-32-bytes",
        },
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    })),
  ],
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    include: ["tests/worker/**/*.test.ts"],
    setupFiles: ["./tests/worker/setup.ts"],
  },
});
