/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeoSettingsApp from "./index";
import { SETTINGS_CATEGORIES } from "../../../../common-src/Constants";

describe("SeoSettingsApp", () => {
  const baseFeed = {
    settings: {
      seoSettings: {
        siteName: "My Site",
        keyTerms: "podcasts, blog",
        publisherType: "Organization",
        publisherName: "My Org",
        twitterHandle: "@myhandle",
        sameAs: ["https://twitter.com/myhandle", "https://github.com/myorg"],
        defaultShareImage: { url: "images/share.png" },
        publisherLogo: { url: "images/logo.png" },
      },
    },
  };

  const baseProps = {
    feed: baseFeed,
    submitting: false,
    submitForType: null,
    setChanged: () => {},
    onSubmit: () => {},
  };

  it("renders values from feed.settings.seoSettings", () => {
    render(<SeoSettingsApp {...baseProps} />);

    expect(screen.getByDisplayValue("My Site")).toBeInTheDocument();
    expect(screen.getByDisplayValue("podcasts, blog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("My Org")).toBeInTheDocument();
    expect(screen.getByDisplayValue("@myhandle")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://twitter.com/myhandle")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://github.com/myorg")).toBeInTheDocument();

    const orgRadio = screen.getByRole("radio", { name: /Organization/i });
    expect(orgRadio).toBeChecked();
  });

  it("defaults to empty values when feed.settings.seoSettings is absent", () => {
    render(<SeoSettingsApp {...baseProps} feed={{ settings: {} }} />);

    const orgRadio = screen.getByRole("radio", { name: /Organization/i });
    expect(orgRadio).toBeChecked();
  });

  it("calls onSubmit with category seoSettings and the edited bundle", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SeoSettingsApp {...baseProps} onSubmit={onSubmit} />);

    const siteNameInput = screen.getByDisplayValue("My Site");
    await user.clear(siteNameInput);
    await user.type(siteNameInput, "New Site Name");

    const updateButton = screen.getByRole("button", { name: /update/i });
    await user.click(updateButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, category, bundle] = onSubmit.mock.calls[0];
    expect(category).toBe(SETTINGS_CATEGORIES.SEO);
    expect(category).toBe("seoSettings");
    expect(bundle.siteName).toBe("New Site Name");
    expect(bundle.publisherType).toBe("Organization");
    expect(bundle.sameAs).toEqual(["https://twitter.com/myhandle", "https://github.com/myorg"]);
  });

  it("adds a new sameAs URL row and includes its filled-in value on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SeoSettingsApp {...baseProps} onSubmit={onSubmit} feed={{ settings: {} }} />);

    const addButton = screen.getByRole("button", { name: /add/i });
    await user.click(addButton);

    const newRowInput = screen.getByPlaceholderText("https://twitter.com/yourhandle");
    await user.type(newRowInput, "https://example.com/profile");

    const updateButton = screen.getByRole("button", { name: /update/i });
    await user.click(updateButton);

    const [, , bundle] = onSubmit.mock.calls[0];
    expect(Array.isArray(bundle.sameAs)).toBe(true);
    expect(bundle.sameAs).toEqual(["https://example.com/profile"]);
  });
});
