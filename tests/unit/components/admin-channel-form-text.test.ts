import {describe, expect, it} from "vitest";

import {
  CHANNEL_CONTROLS,
  CONTROLS_TEXTS_DICT,
} from "@/components/admin/channel/EditChannelApp/FormExplainTexts";

describe("Edit Channel copyright explanation", () => {
  it("explains current_year and shows its resolved output", () => {
    const copyright = CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.COPYRIGHT]!;
    const currentYear = new Date().getUTCFullYear();

    expect(copyright.text).toContain("{{current_year}}");
    expect(copyright.text).toContain("current UTC year");
    expect(copyright.text).toContain(`© ${currentYear} Publisher`);
    expect(copyright.rss).toContain(`© ${currentYear} Publisher`);
    expect(copyright.json).toContain('"copyright"');
    expect(copyright.json).not.toContain('"itunes:type"');
  });
});
