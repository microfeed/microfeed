import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

import {major, prerelease, valid} from "semver";

interface JsonObject {
  [key: string]: JsonObject | string | number | boolean | null | undefined;
}

interface VersionTarget {
  filename: string;
  identity: {field: string; value: string};
  update: (document: JsonObject, version: string) => void;
}

const RELEASE_VERSION_TARGETS: VersionTarget[] = [
  {
    filename: "package.json",
    identity: {field: "name", value: "microfeed"},
    update: (document, version) => {
      document.version = version;
    },
  },
  {
    filename: "packages/cli/package.json",
    identity: {field: "name", value: "@microfeed/cli"},
    update: (document, version) => {
      document.version = version;
    },
  },
  {
    filename: "packages/theme-kit/package.json",
    identity: {field: "name", value: "@microfeed/theme-kit"},
    update: (document, version) => {
      document.version = version;
    },
  },
  {
    filename: "themes/default/microfeed-theme.json",
    identity: {field: "packageId", value: "microfeed.default"},
    update: (document, version) => {
      document.version = version;
    },
  },
  {
    filename: "packages/theme-kit/assets/starter/package.json",
    identity: {field: "name", value: "microfeed-theme"},
    update: (document, version) => {
      const devDependencies = document.devDependencies;
      if (!devDependencies || typeof devDependencies !== "object") {
        throw new Error("The theme starter is missing devDependencies.");
      }
      devDependencies["@microfeed/theme-kit"] = themeKitCompatibilityRange(version);
    },
  },
];

export function themeKitCompatibilityRange(version: string): string {
  const releaseMajor = major(version);
  if (releaseMajor === 0) {
    return `^${version}`;
  }
  if (prerelease(version)) {
    return `>=${version} <${releaseMajor + 1}.0.0`;
  }
  return `^${releaseMajor}.0.0`;
}

export function validateReleaseVersion(input: string | undefined): string {
  if (!input || valid(input) !== input) {
    throw new Error(
      "Provide one exact semantic version, for example: yarn version:set 1.2.3",
    );
  }
  return input;
}

export async function setReleaseVersion(
  repositoryRoot: string,
  input: string,
): Promise<string[]> {
  const version = validateReleaseVersion(input);
  const documents = await Promise.all(RELEASE_VERSION_TARGETS.map(async (target) => {
    const filename = path.join(repositoryRoot, target.filename);
    const document = JSON.parse(await readFile(filename, "utf8")) as JsonObject;
    if (document[target.identity.field] !== target.identity.value) {
      throw new Error(
        `${target.filename} is not the expected ${target.identity.value} metadata file.`,
      );
    }
    return {document, filename, target};
  }));

  for (const {document, target} of documents) {
    target.update(document, version);
  }
  await Promise.all(documents.map(({document, filename}) =>
    writeFile(filename, `${JSON.stringify(document, null, 2)}\n`, "utf8")
  ));
  return documents.map(({target}) => target.filename);
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    throw new Error(
      "Provide one exact semantic version, for example: yarn version:set 1.2.3",
    );
  }
  const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const version = validateReleaseVersion(process.argv[2]);
  const filenames = await setReleaseVersion(repositoryRoot, version);
  process.stdout.write(
    `Synchronized microfeed release ${version}:\n${filenames.map((filename) => `- ${filename}`).join("\n")}\n`,
  );
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entrypoint) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
