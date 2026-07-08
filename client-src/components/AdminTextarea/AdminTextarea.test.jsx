/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTextarea from "./index";

describe("AdminTextarea (smoke)", () => {
  it("renders the label and value, and fires onChange on user input", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(
      <AdminTextarea
        label="Description"
        value="hello"
        onChange={handleChange}
      />
    );

    expect(screen.getByText("Description")).toBeInTheDocument();
    const textarea = screen.getByDisplayValue("hello");
    expect(textarea).toBeInTheDocument();

    await user.type(textarea, "!");

    expect(handleChange).toHaveBeenCalled();
  });
});
