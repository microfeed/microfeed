/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccessSettingsApp from "./index";

describe("AccessSettingsApp (smoke)", () => {
  const baseProps = {
    feed: { settings: {} },
    submitting: false,
    submitForType: null,
    setChanged: () => {},
    onSubmit: () => {},
  };

  it("renders the access options as radio controls, defaulting to public", () => {
    render(<AccessSettingsApp {...baseProps} />);

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(2);
    const publicRadio = screen.getByRole("radio", { name: /Public/i });
    expect(publicRadio).toHaveAttribute("aria-checked", "true");
  });

  it("selects the offline option when clicked", async () => {
    const user = userEvent.setup();
    render(<AccessSettingsApp {...baseProps} />);

    const offlineRadio = screen.getByRole("radio", { name: /Offline/i });
    await user.click(offlineRadio);

    expect(offlineRadio).toHaveAttribute("aria-checked", "true");
  });
});
