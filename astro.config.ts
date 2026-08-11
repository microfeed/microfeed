import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import {defineConfig, sessionDrivers} from "astro/config";
import type {Connect, Plugin} from "vite";

const THEME_PREVIEW_ASSET_DESTINATIONS = new Set([
  "audio",
  "font",
  "image",
  "script",
  "style",
  "track",
  "video",
]);

function allowSandboxedThemePreviewAssets(): Plugin {
  return {
    enforce: "post",
    name: "microfeed-sandboxed-theme-preview-assets",
    configureServer(server) {
      const middleware: Connect.NextHandleFunction = (
        request,
        _response,
        next,
      ) => {
        const method = request.method?.toUpperCase();
        let path = "";
        try {
          path = new URL(request.url ?? "/", "http://localhost").pathname;
        } catch {
          next();
          return;
        }
        const isPublicAsset = path.startsWith("/assets/") ||
          path.startsWith("/media/");
        if (
          (method === "GET" || method === "HEAD") &&
          (request.headers.origin === undefined ||
            request.headers.origin === "null") &&
          request.headers["sec-fetch-site"] === "cross-site" &&
          typeof request.headers["sec-fetch-dest"] === "string" &&
          THEME_PREVIEW_ASSET_DESTINATIONS.has(
            request.headers["sec-fetch-dest"],
          ) &&
          isPublicAsset
        ) {
          // Astro correctly blocks general cross-origin subresources in dev.
          // The isolated theme iframe has an opaque `null` origin, though, so
          // let only public theme/media assets pass that guard.
          request.headers["sec-fetch-site"] = "same-site";
        }
        next();
      };
      return () => {
        // Astro prepends its Fetch Metadata guard after Vite plugin setup.
        // Prepend this narrow exception after that guard is registered.
        server.middlewares.stack.unshift({handle: middleware, route: ""});
      };
    },
  };
}

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
    plugins: [
      allowSandboxedThemePreviewAssets(),
      optimizeWorkerDependencies(),
    ],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
});
