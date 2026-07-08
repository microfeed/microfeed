/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDatetimePicker from "./index";

describe("AdminDatetimePicker (smoke)", () => {
  it("renders the label and a datetime-local input, and fires onChange on user input", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(
      <AdminDatetimePicker
        label="Publish date"
        value={null}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("Publish date")).toBeInTheDocument();
    const input = document.querySelector('input[type="datetime-local"]');
    expect(input).toBeInTheDocument();

    await user.type(input, "2024-01-01T10:00");

    expect(handleChange).toHaveBeenCalled();
  });
});
