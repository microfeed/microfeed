/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminNavApp from "./index";
import { NAV_ITEMS } from "../../../common-src/Constants";

function setFeedContent() {
  document.body.innerHTML = `
    <script id="feed-content" type="application/json">
      ${JSON.stringify({
        settings: {
          brandName: "Microfeed",
          webGlobalSettings: {
            publicBucketUrl: "https://cdn.example.com",
          },
        },
      })}
    </script>
  `;
}

function mockMatchMedia(matches) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

describe("AdminNavApp", () => {
  beforeEach(() => {
    setFeedContent();
    mockMatchMedia(false);
  });

  it("starts with the admin navigation collapsed and opens it on demand", async () => {
    const user = userEvent.setup();

    render(
      <AdminNavApp currentPage={NAV_ITEMS.NEW_ITEM} onboardingResult={{ requiredOk: true }}>
        <div>Workspace body</div>
      </AdminNavApp>
    );

    expect(screen.queryByRole("link", { name: /add new item/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open navigation/i }));

    expect(screen.getByRole("link", { name: /add new item/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse navigation/i })).toBeInTheDocument();
  });

  it("uses drawer semantics for the admin navigation on mobile", async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);

    render(
      <AdminNavApp currentPage={NAV_ITEMS.NEW_ITEM} onboardingResult={{ requiredOk: true }}>
        <div>Workspace body</div>
      </AdminNavApp>
    );

    await user.click(screen.getByRole("button", { name: /open navigation/i }));

    expect(screen.getByRole("dialog", { name: /navigation/i })).toBeInTheDocument();
  });
});
