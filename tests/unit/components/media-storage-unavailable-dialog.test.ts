import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import AdminFileUploader from "@/components/admin/shared/AdminFileUploader";
import AdminRadio from "@/components/admin/shared/AdminRadio";
import {MediaStorageSetupInstructions} from "@/components/admin/shared/MediaStorageUnavailableDialog";

describe("media storage unavailable guidance", () => {
  it("explains Cloudflare activation and deferred deployment", () => {
    const output = renderToStaticMarkup(
      React.createElement(MediaStorageSetupInstructions, {
        dashboardUrl: "https://dash.cloudflare.com/account-id/r2/overview",
        state: "pending",
      }),
    );

    expect(output).toContain("Activate R2 in Cloudflare");
    expect(output).toContain("yarn manage deploy --enable-r2");
    expect(output).not.toContain("deploy --local");
  });

  it("uses the local enablement command without Cloudflare billing guidance", () => {
    const output = renderToStaticMarkup(
      React.createElement(MediaStorageSetupInstructions, {
        state: "disabled",
      }),
    );

    expect(output).toContain(
      "yarn manage deploy --local --enable-r2",
    );
    expect(output).not.toContain("Activate R2 in Cloudflare");
  });

  it("keeps disabled upload controls discoverable for modal guidance", () => {
    const onDisabledClick = vi.fn();
    const radio = renderToStaticMarkup(
      React.createElement(AdminRadio, {
        buttons: [{
          checked: false,
          disabled: true,
          name: "audio",
          onDisabledClick,
          value: "audio",
        }],
        groupName: "category",
        onChange: vi.fn(),
      }),
    );
    const uploader = renderToStaticMarkup(
      React.createElement(
        AdminFileUploader,
        {
          children: "Upload image",
          disabled: true,
          handleChange: vi.fn(),
          name: "imageUploader",
          onDisabledClick,
        },
      ),
    );

    expect(radio).toContain('aria-disabled="true"');
    expect(radio).not.toContain(" disabled=\"\"");
    expect(uploader).toContain('aria-disabled="true"');
    expect(uploader).toContain('tabindex="0"');
  });
});
