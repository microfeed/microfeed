import {expect, test} from "vitest";

import packageMetadata from "../../../package.json";
import {
  MICROFEED_PACKAGE_MANAGER,
  MICROFEED_VERSION,
} from "@/shared/Version";

test("uses the package version as the application version", () => {
  expect(MICROFEED_VERSION).toBe(packageMetadata.version);
  expect(MICROFEED_PACKAGE_MANAGER).toBe(packageMetadata.packageManager);
});
