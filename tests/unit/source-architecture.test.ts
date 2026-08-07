import {access, readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";
import {API_BASE_PATH, API_MAJOR_VERSION} from "@/shared/ApiVersion";
import {MICROFEED_VERSION} from "@/shared/Version";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const legacyRoots = [
  ["edge", "src"].join("-"),
  ["client", "src"].join("-"),
  ["common", "src"].join("-"),
];
const legacyUiPackages = [
  ["@", "headlessui", "react"].join("/"),
  ["@", "heroicons", "react"].join("/"),
];
const lucidePackage = ["lucide", "react"].join("-");
const lucideDynamicImport = [lucidePackage, "dynamic"].join("/");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(filename);
      }
      return /\.(?:astro|css|json|jsonc|ts|tsx|ya?ml)$/u.test(entry.name)
        ? [filename]
        : [];
    }),
  );
  return files.flat();
}

async function contentsUnder(directory: string): Promise<string> {
  const files = await sourceFiles(directory);
  return (await Promise.all(files.map((file) => readFile(file, "utf8"))))
    .join("\n");
}

describe("source architecture", () => {
  it("generates the canonical OpenAPI contract from shared schemas", () => {
    const openApi = JSON.stringify(OPENAPI_DOCUMENT);

    expect(OPENAPI_DOCUMENT.openapi).toBe("3.1.1");
    expect(OPENAPI_DOCUMENT.servers).toEqual([{
      description: "This microfeed instance API",
      url: API_BASE_PATH,
    }]);
    expect(Number(MICROFEED_VERSION.split(".")[0])).toBe(API_MAJOR_VERSION);
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty("/feed/");
    expect(openApi).toContain("bearerAuth");
    expect(openApi).not.toContain("legacyApiKey");
    expect(openApi).not.toContain("X-MicrofeedAPI-Key");
    expect(openApi).toContain('"published_at"');
    expect(openApi).toContain('"created_at"');
    expect(openApi).toContain('"updated_at"');
    expect(openApi).toContain('"name":"order"');
    expect(openApi).toContain('"name":"prev_cursor"');
    expect(openApi).toContain(API_BASE_PATH);
    expect(openApi).not.toContain("updated_desc");
    expect(openApi).not.toContain("updated_asc");
  });

  it("saves only canonical public feed sorting settings", async () => {
    const settingsSource = await readFile(
      path.join(
        repositoryRoot,
        "src",
        "components",
        "admin",
        "settings",
        "ItemsSettingsApp",
        "index.tsx",
      ),
      "utf8",
    );

    expect(settingsSource).toContain("itemsOrder,");
    expect(settingsSource).toContain("itemsSort,");
    expect(settingsSource).not.toContain("itemsSortOrder");
    expect(settingsSource).toContain("Published at");
    expect(settingsSource).toContain("Created at");
    expect(settingsSource).toContain("Updated at");
  });

  it("has no legacy source roots or references", async () => {
    for (const directory of legacyRoots) {
      await expect(
        access(path.join(repositoryRoot, directory)),
      ).rejects.toMatchObject({code: "ENOENT"});
    }

    const contents = [
      await contentsUnder(path.join(repositoryRoot, "src")),
      await contentsUnder(path.join(repositoryRoot, "manage-cli")),
      await contentsUnder(path.join(repositoryRoot, "tests")),
      await contentsUnder(path.join(repositoryRoot, ".github")),
      await readFile(path.join(repositoryRoot, "astro.config.ts"), "utf8"),
      await readFile(path.join(repositoryRoot, "components.json"), "utf8"),
      await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
      await readFile(path.join(repositoryRoot, "tsconfig.json"), "utf8"),
      await readFile(path.join(repositoryRoot, "vitest.config.ts"), "utf8"),
      await readFile(
        path.join(repositoryRoot, "vitest.worker.config.ts"),
        "utf8",
      ),
      await readFile(
        path.join(repositoryRoot, "wrangler.template.jsonc"),
        "utf8",
      ),
    ].join("\n");

    for (const directory of legacyRoots) {
      expect(contents).not.toContain(`${directory}/`);
    }
  });

  it("keeps browser, Worker, and repository tooling boundaries separate", async () => {
    const browserContents = [
      await contentsUnder(path.join(repositoryRoot, "src", "client")),
      await contentsUnder(path.join(repositoryRoot, "src", "components")),
    ].join("\n");
    const serverContents = await contentsUnder(
      path.join(repositoryRoot, "src", "server"),
    );
    const manageCliContents = await contentsUnder(
      path.join(repositoryRoot, "manage-cli"),
    );

    expect(browserContents).not.toContain('from "@/server/');
    expect(serverContents).not.toContain('from "@/client/');
    expect(serverContents).not.toContain('from "@/components/');
    expect(manageCliContents).not.toContain('from "@/server/');
    expect(manageCliContents).not.toContain('from "@/client/');
    expect(manageCliContents).not.toContain('from "@/components/');
  });

  it("preserves stable public asset paths", async () => {
    await expect(
      access(
        path.join(
          repositoryRoot,
          "public",
          "assets",
          "default",
          "favicon.png",
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(
          repositoryRoot,
          "public",
          "assets",
          "brands",
          "subscribe",
          "rss.png",
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(
          repositoryRoot,
          "public",
          "assets",
          "brands",
          "microfeed",
          "horizontal-logo.png",
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(
          repositoryRoot,
          "public",
          "assets",
          "brands",
          "microfeed",
          "horizontal-logo-dark.png",
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("preserves the nested admin code editor route", async () => {
    const route = path.join(
      repositoryRoot,
      "src",
      "pages",
      "[adminPath]",
      "settings",
      "code-editor",
      "index.astro",
    );

    await expect(access(route)).resolves.toBeUndefined();
    await expect(readFile(route, "utf8")).resolves.toContain(
      "<CustomCodeEditorApp",
    );
    const routeSource = await readFile(route, "utf8");
    expect(routeSource).toContain("settingsNavigation");
    expect(routeSource).toContain('settingsActiveSection="custom-code"');
  });

  it("keeps API settings on their standalone auto-saving page", async () => {
    const [apiRoute, apiSettings, settingsPage] = await Promise.all([
      readFile(
        path.join(
          repositoryRoot,
          "src",
          "pages",
          "[adminPath]",
          "api",
          "settings",
          "index.astro",
        ),
        "utf8",
      ),
      readFile(
        path.join(
          repositoryRoot,
          "src",
          "components",
          "admin",
          "api",
          "ApiSettingsApp.tsx",
        ),
        "utf8",
      ),
      readFile(
        path.join(
          repositoryRoot,
          "src",
          "components",
          "admin",
          "settings",
          "SettingsApp.tsx",
        ),
        "utf8",
      ),
    ]);

    expect(apiRoute).toContain("<ApiSettingsApp");
    expect(apiRoute).toContain("apiNavigation");
    expect(apiSettings).toContain("onChange={(enabled) => save");
    expect(apiSettings).toContain("Publish API docs");
    expect(settingsPage).not.toContain("ApiSettingsApp");
  });

  it("keeps the items list free of a redundant page card", async () => {
    const itemsList = await readFile(
      path.join(
        repositoryRoot,
        "src",
        "components",
        "admin",
        "items",
        "AllItemsApp",
        "index.tsx",
      ),
      "utf8",
    );

    expect(itemsList).not.toContain('@/components/ui/card');
    expect(itemsList).not.toContain("NAV_ITEMS_DICT");
    expect(itemsList).toContain("<ItemListTable data={data} feed={feed} />");
  });

  it("keeps web settings as three independent cards", async () => {
    const settingsDirectory = path.join(
      repositoryRoot,
      "src",
      "components",
      "admin",
      "settings",
    );
    const [settingsPage, mediaStorage, itemsSettings, faviconSettings] =
      await Promise.all([
        readFile(path.join(settingsDirectory, "SettingsApp.tsx"), "utf8"),
        readFile(
          path.join(settingsDirectory, "MediaFileStorageSettingsApp", "index.tsx"),
          "utf8",
        ),
        readFile(
          path.join(settingsDirectory, "ItemsSettingsApp", "index.tsx"),
          "utf8",
        ),
        readFile(
          path.join(settingsDirectory, "FaviconSettingsApp", "index.tsx"),
          "utf8",
        ),
      ]);

    expect(settingsPage).not.toContain("WebGlobalSettingsApp");
    expect(settingsPage).toContain('id="media-file-storage"');
    expect(settingsPage).toContain('id="items-settings"');
    expect(settingsPage).toContain('id="favicon"');
    expect(settingsPage).toContain('className="h-[50vh]"');
    expect(mediaStorage).toContain('title="Media file storage"');
    expect(mediaStorage).toContain('label="R2 public bucket URL"');
    expect(itemsSettings).toContain('title="Items settings"');
    expect(faviconSettings).toContain('title="Favicon"');
    expect([mediaStorage, itemsSettings, faviconSettings].join("\n"))
      .not.toContain("<details");
  });

  it("keeps the admin sidebar aligned with the darker shell canvas", async () => {
    const adminStyles = await readFile(
      path.join(repositoryRoot, "src", "styles", "admin.css"),
      "utf8",
    );
    const adminShell = await readFile(
      path.join(repositoryRoot, "src", "layouts", "AdminShell.astro"),
      "utf8",
    );

    expect(adminStyles).toMatch(
      /:root \{[\s\S]*?--admin-canvas: #f5f7fa;[\s\S]*?--sidebar: #f5f7fa;/u,
    );
    expect(adminStyles).toMatch(
      /\.dark \{[\s\S]*?--admin-canvas: #171721;[\s\S]*?--sidebar: #171721;/u,
    );
    expect(adminShell).toContain("flex-1 bg-background");
    expect(adminShell).toContain("lg:h-svh lg:min-h-0");
    expect(adminShell).toContain("lg:flex-col lg:overflow-hidden");
    expect(adminShell).toContain('class="lg:h-full lg:overflow-hidden"');
    expect(adminShell).toContain(
      "lg:flex-1 lg:overscroll-contain lg:overflow-y-auto",
    );
  });

  it("keeps edit action rails below the shell edge and the toaster in the shell", async () => {
    const [channelEditor, itemEditor, adminPageApp, adminShell, sonner] = await Promise.all([
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "channel", "EditChannelApp", "index.tsx"),
        "utf8",
      ),
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "items", "EditItemApp", "index.tsx"),
        "utf8",
      ),
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "shared", "AdminPageApp", "index.tsx"),
        "utf8",
      ),
      readFile(path.join(repositoryRoot, "src", "layouts", "AdminShell.astro"), "utf8"),
      readFile(path.join(repositoryRoot, "src", "components", "ui", "sonner.tsx"), "utf8"),
    ]);

    expect(channelEditor).toContain("xl:sticky xl:top-4");
    expect(itemEditor).toContain("xl:sticky xl:top-4");
    expect(channelEditor).toContain("new AutosaveCoordinator");
    expect(itemEditor).toContain("new AutosaveCoordinator");
    expect(channelEditor).toContain("<AdminAutosaveAction");
    expect(itemEditor).toContain("<AdminAutosaveAction");
    expect(itemEditor).toContain("status: STATUSES.UNPUBLISHED");
    expect(itemEditor).toContain("Start editing to create an unpublished draft.");
    expect(adminPageApp).not.toContain("<Toaster");
    expect(adminShell).toContain('transition:persist="admin-toaster"');
    expect(adminShell).toContain('position="top-right"');
    expect(sonner).toContain('import "sonner/dist/styles.css"');
  });

  it("centers desktop page titles and leads with mobile navigation", async () => {
    const [topBar, headerActions, mobileNavigation] = await Promise.all([
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "AdminTopBar.astro"),
        "utf8",
      ),
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "AdminHeaderActions.tsx"),
        "utf8",
      ),
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "AdminMobileNavigation.tsx"),
        "utf8",
      ),
    ]);

    expect(topBar).toContain(
      "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
    );
    expect(topBar).toContain("truncate text-center text-lg");
    expect(topBar.indexOf("<AdminMobileNavigation")).toBeLessThan(
      topBar.indexOf("lg:hidden\">{pageTitle}"),
    );
    expect(headerActions).not.toContain("MenuIcon");
    expect(mobileNavigation).toContain('aria-label="Open admin navigation"');
  });

  it("uses a single back link instead of a breadcrumb trail for item editing", async () => {
    const [topBar, itemEditorRoute] = await Promise.all([
      readFile(
        path.join(repositoryRoot, "src", "components", "admin", "AdminTopBar.astro"),
        "utf8",
      ),
      readFile(
        path.join(
          repositoryRoot,
          "src",
          "pages",
          "[adminPath]",
          "items",
          "[itemId]",
          "index.astro",
        ),
        "utf8",
      ),
    ]);

    expect(topBar).toContain('breadcrumb.kind === "back"');
    expect(topBar).toContain('aria-hidden="true" class="text-base leading-none">←</span>');
    expect(itemEditorRoute).toContain('kind: "back"');
    expect(itemEditorRoute).not.toContain("childName:");
  });

  it("targets only authenticated Cloudflare production Workers in update prompts", async () => {
    const adminShell = await readFile(
      path.join(repositoryRoot, "src", "layouts", "AdminShell.astro"),
      "utf8",
    );

    expect(adminShell).toContain('env.DEPLOYMENT_ENVIRONMENT === "production"');
    expect(adminShell).toContain("env.MICROFEED_CLOUDFLARE_ACCOUNT_ID?.trim()");
    expect(adminShell).toContain("protectedDashboard &&");
  });

  it("standardizes UI primitives and icons", async () => {
    const sourceContents = await contentsUnder(
      path.join(repositoryRoot, "src"),
    );
    const manifestContents = await readFile(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    );
    const componentConfig = JSON.parse(await readFile(
      path.join(repositoryRoot, "components.json"),
      "utf8",
    ));

    for (const packageName of legacyUiPackages) {
      expect(sourceContents).not.toContain(packageName);
      expect(manifestContents).not.toContain(packageName);
    }
    expect(sourceContents).not.toContain(["react", "toastify"].join("-"));
    expect(manifestContents).not.toContain(["react", "toastify"].join("-"));
    expect(sourceContents).not.toContain(["lh", "btn"].join("-"));
    expect(sourceContents).not.toContain(["lh", "page", "card"].join("-"));
    expect(sourceContents).not.toContain(lucideDynamicImport);
    expect(sourceContents).not.toMatch(new RegExp(
      `import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+["']${lucidePackage}["']`,
      "u",
    ));
    expect(componentConfig.iconLibrary).toBe("lucide");
  });
});
