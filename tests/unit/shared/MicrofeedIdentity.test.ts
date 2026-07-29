import {describe, expect, it} from "vitest";

import {microfeedIdentity} from "@/shared/MicrofeedIdentity";
import {MICROFEED_VERSION} from "@/shared/Version";

describe("microfeed identity", () => {
  it("publishes the current Worker version timestamp without version identifiers", () => {
    expect(microfeedIdentity(
      "instance-id",
      "2026-07-30T21:15:42.123Z",
    )).toEqual({
      applicationVersion: MICROFEED_VERSION,
      deployedAt: "2026-07-30T21:15:42.123Z",
      instanceId: "instance-id",
      product: "microfeed",
    });
  });
});
