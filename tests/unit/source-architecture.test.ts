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
  });
});
