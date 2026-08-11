import {readFile} from "node:fs/promises";
import {satisfies} from "semver";
import {expect, test} from "vitest";

async function metadata(relativePath: string): Promise<{
  devDependencies?: Record<string, string>;
  version: string;
}> {
  const contents = await readFile(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(contents);
}

test("keeps published microfeed tools on the application release version", async () => {
  const [application, contentCli, themeKit, defaultTheme, genericStarter] =
    await Promise.all([
      metadata("package.json"),
      metadata("packages/cli/package.json"),
      metadata("packages/theme-kit/package.json"),
      metadata("themes/default/package.json"),
      metadata("packages/theme-kit/assets/starter/package.json"),
    ]);
  expect(contentCli.version).toBe(application.version);
  expect(themeKit.version).toBe(application.version);
  expect(defaultTheme.devDependencies?.["@microfeed/theme-kit"])
    .toBe("workspace:^");
  expect(defaultTheme.version).toBe("0.0.0-use.local");
  expect(satisfies(
    application.version,
    genericStarter.devDependencies?.["@microfeed/theme-kit"] ?? "",
  )).toBe(true);
});
