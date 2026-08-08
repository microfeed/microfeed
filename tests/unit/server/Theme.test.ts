import {afterEach, describe, expect, it, vi} from "vitest";

import {CODE_FILES, SETTINGS_CATEGORIES} from "@/shared/Constants";
import Theme from "@/server/themes/Theme";

afterEach(() => {
  vi.useRealTimers();
});

describe("theme built-in variables", () => {
  it("renders current_year in every custom Mustache template", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));

    const variable = "{{current_year}}";
    const settings = {
      [SETTINGS_CATEGORIES.CUSTOM_CODE]: {
        currentTheme: "custom",
        themes: {
          custom: {
            [CODE_FILES.RSS_STYLESHEET]: variable,
            [CODE_FILES.WEB_BODY_END]: variable,
            [CODE_FILES.WEB_BODY_START]: variable,
            [CODE_FILES.WEB_FEED]: variable,
            [CODE_FILES.WEB_HEADER]: variable,
            [CODE_FILES.WEB_ITEM]: variable,
          },
        },
      },
    };
    const theme = new Theme({}, settings);

    expect(theme.getWebHeader().html).toBe("2027");
    expect(theme.getWebBodyStart().html).toBe("2027");
    expect(theme.getWebBodyEnd().html).toBe("2027");
    expect(theme.getWebFeed().html).toBe("2027");
    expect(theme.getWebItem({}).html).toBe("2027");
    expect(theme.getRssStylesheet().stylesheet).toBe("2027");
  });
});
