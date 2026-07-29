import {expect, test} from "vitest";

import packageMetadata from "../../../package.json";
import {MICROFEED_VERSION} from "@/shared/Version";

test("uses the package version as the application version", () => {
  expect(MICROFEED_VERSION).toBe(packageMetadata.version);
});
