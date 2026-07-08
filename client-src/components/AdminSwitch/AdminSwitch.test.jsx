/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSwitch from "./index";

describe("AdminSwitch", () => {
  it("renders the label and reflects the checked state", () => {
    render(<AdminSwitch label="Enable feature" enabled={true} setEnabled={() => {}} />);

    expect(screen.getAllByText("Enable feature").length).toBeGreaterThan(0);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("reflects an unchecked state when disabled", () => {
    render(<AdminSwitch label="Enable feature" enabled={false} setEnabled={() => {}} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("fires setEnabled with the new value when toggled", async () => {
    const user = userEvent.setup();
    const setEnabled = jest.fn();

    render(<AdminSwitch label="Enable feature" enabled={false} setEnabled={setEnabled} />);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("fires setEnabled with false when toggled off", async () => {
    const user = userEvent.setup();
    const setEnabled = jest.fn();

    render(<AdminSwitch label="Enable feature" enabled={true} setEnabled={setEnabled} />);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(setEnabled).toHaveBeenCalledWith(false);
  });
});
