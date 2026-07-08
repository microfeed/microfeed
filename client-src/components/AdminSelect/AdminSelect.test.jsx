/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSelect from "./index";

describe("AdminSelect (smoke)", () => {
  it("renders the label and options, and fires onChange on selection", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    const options = [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ];

    render(
      <AdminSelect
        label="Choose one"
        value={options[0]}
        options={options}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("Choose one")).toBeInTheDocument();
    expect(screen.getByText("Option A")).toBeInTheDocument();

    // Open the menu and select the other option.
    const control = screen.getByText("Option A");
    await user.click(control);
    const optionB = await screen.findByText("Option B");
    await user.click(optionB);

    expect(handleChange).toHaveBeenCalled();
  });
});
