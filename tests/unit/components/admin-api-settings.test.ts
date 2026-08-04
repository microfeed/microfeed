import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import ApiSettingsApp from "@/components/admin/settings/ApiSettingsApp";

describe("admin API settings", () => {
  it("renders the standalone auto-saving controls without a section header or update button", () => {
    const output = renderToStaticMarkup(
      React.createElement(ApiSettingsApp, {
        feed: {
          settings: {
            apiSettings: {
              apps: [{
                createdAtMs: 1_800_000_000_000,
                id: "default-app",
                name: "Default",
                token: "saved-api-token",
              }],
              enabled: true,
            },
          },
        },
      }),
    );

    expect(output).toContain("API enabled");
    expect(output).toContain("saved-api-token");
    expect(output).not.toContain("Changes save automatically");
    expect(output).toContain("API documentation");
    expect(output).not.toContain('data-slot="card-header"');
    expect(output).not.toContain(">Update</button>");
  });
});
