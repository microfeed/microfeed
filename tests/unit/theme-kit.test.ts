import {cp, mkdtemp, readFile, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import * as z from "zod";

import {loadThemePackage} from "../../packages/theme-kit/src/package";
import {generatedThemeReadme} from "../../packages/theme-kit/src/readme";
import {
  THEME_MAX_TEMPLATE_BYTES,
  themeContextSchema,
  themeManifestV1Schema,
} from "@/shared/themes/ThemeContract";

const temporaryDirectories: string[] = [];

async function themeDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-theme-kit-test-"));
  temporaryDirectories.push(directory);
  await cp(
    new URL("../../packages/theme-kit/assets/starter/", import.meta.url),
    directory,
    {recursive: true},
  );
  return directory;
}

afterEach(async () => {
  const {rm} = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("@microfeed/theme-kit package loading", () => {
  it("keeps generated schemas and agent instructions synchronized", async () => {
    const starter = new URL(
      "../../packages/theme-kit/assets/starter/",
      import.meta.url,
    );
    const [manifestSchema, contextSchema, readme] = await Promise.all([
      readFile(new URL(".microfeed/schemas/manifest.schema.json", starter), "utf8"),
      readFile(new URL(".microfeed/schemas/theme-context.schema.json", starter), "utf8"),
      readFile(new URL("THEME.md", starter), "utf8"),
    ]);
    expect(JSON.parse(manifestSchema)).toEqual(z.toJSONSchema(themeManifestV1Schema));
    expect(JSON.parse(contextSchema)).toEqual(z.toJSONSchema(themeContextSchema));
    expect(readme).toBe(generatedThemeReadme());
  });

  it("loads the starter as a complete text-only package", async () => {
    const loaded = await loadThemePackage(await themeDirectory());
    expect(loaded.manifest.packageId).toBe("example.my-theme");
    expect(loaded.assetFiles).toEqual([]);
    expect(loaded.bundle.webFeed).toContain("{{#items}}");
  });

  it("rejects symlinked declared files", async () => {
    const directory = await themeDirectory();
    await symlink(
      path.join(directory, "web-feed.mustache"),
      path.join(directory, "linked-feed.mustache"),
    );
    const manifestFile = path.join(directory, "microfeed-theme.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    manifest.files.webFeed = "linked-feed.mustache";
    await writeFile(manifestFile, JSON.stringify(manifest));
    await expect(loadThemePackage(directory)).rejects.toThrow("Symlinks are not allowed");
  });

  it("rejects unsupported declared asset types", async () => {
    const directory = await themeDirectory();
    const manifestFile = path.join(directory, "microfeed-theme.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    manifest.assets = ["assets/payload.exe"];
    await writeFile(manifestFile, JSON.stringify(manifest));
    await writeFile(path.join(directory, "assets", "payload.exe"), "payload");
    await expect(loadThemePackage(directory)).rejects.toThrow("Unsupported theme asset type");
  });

  it("rejects oversized and non-UTF-8 template files before loading them", async () => {
    const oversized = await themeDirectory();
    await writeFile(
      path.join(oversized, "web-feed.mustache"),
      "x".repeat(THEME_MAX_TEMPLATE_BYTES + 1),
    );
    await expect(loadThemePackage(oversized)).rejects.toThrow("exceeds");

    const binary = await themeDirectory();
    await writeFile(
      path.join(binary, "web-feed.mustache"),
      new Uint8Array([0xff, 0xfe]),
    );
    await expect(loadThemePackage(binary)).rejects.toThrow("valid UTF-8");
  });
});
