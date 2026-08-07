import {readFile, readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  return (await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? filesUnder(filename)
      : /\.(?:astro|ts|tsx)$/u.test(entry.name) ? [filename] : [];
  }))).flat();
}

describe("API terminology", () => {
  it("distinguishes API keys from OAuth access tokens", async () => {
    const directories = [
      path.join(repositoryRoot, "src", "components", "admin", "api"),
      path.join(repositoryRoot, "src", "server", "api"),
      path.join(repositoryRoot, "src", "shared", "OpenApiDocument.ts"),
    ];
    const files = (await Promise.all(directories.map(async (entry) =>
      entry.endsWith(".ts") ? [entry] : filesUnder(entry)
    ))).flat();
    const source = (await Promise.all(files.map((file) => readFile(file, "utf8"))))
      .join("\n");

    expect(source).not.toMatch(/\bAPI tokens?\b/iu);
    expect(source).not.toMatch(/\bAPI access tokens?\b/iu);
    expect(source).toContain("API key");
    expect(source).toContain("OAuth access token");
  });
});
