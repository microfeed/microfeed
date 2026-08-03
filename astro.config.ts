import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import {defineConfig, sessionDrivers} from "astro/config";
import type {Plugin} from "vite";

function optimizeWorkerDependencies(): Plugin {
  return {
    name: "microfeed-optimize-worker-dependencies",
    configEnvironment(environment) {
      if (environment !== "client") {
        return {
          optimizeDeps: {
            include: ["better-auth", "better-auth/plugins"],
          },
        };
      }
      return undefined;
    },
  };
}

export default defineConfig({
  adapter: cloudflare({
    configPath: process.env.MICROFEED_WRANGLER_CONFIG ?? "./wrangler.jsonc",
    imageService: "passthrough",
    persistState: process.env.MICROFEED_LOCAL_STATE
      ? {path: process.env.MICROFEED_LOCAL_STATE}
      : true,
  }),
  integrations: [react()],
  output: "server",
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
  // microfeed does not use Astro sessions. Supplying a driver prevents the
  // adapter from automatically provisioning an otherwise unused KV namespace.
  session: {
    driver: sessionDrivers.lruCache(),
  },
  // Middleware canonicalizes page-like paths with a trailing slash while
  // keeping direct file URLs (for example, .png and .xml) slashless.
  trailingSlash: "ignore",
  vite: {
    optimizeDeps: {
      include: ["better-auth/client/plugins", "better-auth/react"],
    },
    plugins: [optimizeWorkerDependencies()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
});
