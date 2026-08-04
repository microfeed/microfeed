import {access, readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

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
  });

  it("keeps edit action rails top-aligned and the toaster in the shell", async () => {
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

    expect(channelEditor).toContain("xl:sticky xl:top-0");
    expect(itemEditor).toContain("xl:sticky xl:top-0");
    expect(channelEditor).toContain("showToast('No changes to save.', 'info')");
    expect(itemEditor).toContain("'Add some item details before creating it.'");
    expect(channelEditor).not.toContain("submitting || !changed");
    expect(itemEditor).not.toContain("submitting || !changed");
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
