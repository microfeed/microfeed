import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {describe, expect, it} from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

interface LicenseEntry {
  file: string;
  jsonPath: string;
  value: string;
}

function stringLicenseEntries(
  value: unknown,
  file: string,
  jsonPath = "$",
): LicenseEntry[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      stringLicenseEntries(entry, file, `${jsonPath}[${index}]`)
    );
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const entryPath = `${jsonPath}.${key}`;
    if (key === "license" && typeof entry === "string") {
      return [{file, jsonPath: entryPath, value: entry}];
    }
    return stringLicenseEntries(entry, file, entryPath);
  });
}

describe("JSON license metadata", () => {
  it("uses AGPL-3.0 for every tracked string license field", () => {
    const files = execFileSync(
      "git",
      ["ls-files", "-z", "--", "*.json"],
      {cwd: root, encoding: "utf8"},
    ).split("\0").filter(Boolean);
    const licenses = files.flatMap((file) =>
      stringLicenseEntries(
        JSON.parse(readFileSync(path.join(root, file), "utf8")),
        file,
      )
    );

    expect(licenses.length).toBeGreaterThanOrEqual(6);
    for (const license of licenses) {
      expect(
        license.value,
        `${license.file} ${license.jsonPath}`,
      ).toBe("AGPL-3.0");
    }
  });
});
