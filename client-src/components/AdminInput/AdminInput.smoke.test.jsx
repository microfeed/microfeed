/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminInput from "./index";

describe("AdminInput (smoke)", () => {
  it("renders the label and value, and fires onChange on user input", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(
      <AdminInput
        label="Title"
        value="hello"
        onChange={handleChange}
      />
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    const input = screen.getByDisplayValue("hello");
    expect(input).toBeInTheDocument();

    await user.type(input, "!");

    expect(handleChange).toHaveBeenCalled();
  });
});
