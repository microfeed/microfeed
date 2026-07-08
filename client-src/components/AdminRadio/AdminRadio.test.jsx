/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminRadio from "./index";

describe("AdminRadio (smoke)", () => {
  it("renders the label and buttons, and fires onChange on selection", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    const buttons = [
      { name: "Yes", value: "yes", checked: true },
      { name: "No", value: "no", checked: false },
    ];

    render(
      <AdminRadio
        label="Pick one"
        groupName="pick-one"
        buttons={buttons}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("Pick one")).toBeInTheDocument();
    const yesRadio = screen.getByRole("radio", { name: "Yes" });
    const noRadio = screen.getByRole("radio", { name: "No" });
    expect(yesRadio).toBeChecked();
    expect(noRadio).not.toBeChecked();

    await user.click(noRadio);

    expect(handleChange).toHaveBeenCalled();
  });
});
