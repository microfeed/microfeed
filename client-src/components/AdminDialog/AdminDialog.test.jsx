/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDialog from "./index";

describe("AdminDialog", () => {
  it("renders the title and children when open", async () => {
    render(
      <AdminDialog title="My Dialog" isOpen={true} setIsOpen={() => {}}>
        <div>Dialog body content</div>
      </AdminDialog>
    );

    expect(await screen.findByText("My Dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog body content")).toBeInTheDocument();
  });

  it("does not render content when closed", async () => {
    render(
      <AdminDialog title="My Dialog" isOpen={false} setIsOpen={() => {}}>
        <div>Dialog body content</div>
      </AdminDialog>
    );

    expect(screen.queryByText("My Dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Dialog body content")).not.toBeInTheDocument();
  });

  it("calls setIsOpen(false) when the close button is clicked", async () => {
    const user = userEvent.setup();
    const setIsOpen = jest.fn();

    render(
      <AdminDialog title="My Dialog" isOpen={true} setIsOpen={setIsOpen}>
        <div>Dialog body content</div>
      </AdminDialog>
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it("disables the close button when disabledClose is true", async () => {
    render(
      <AdminDialog title="My Dialog" isOpen={true} setIsOpen={() => {}} disabledClose={true}>
        <div>Dialog body content</div>
      </AdminDialog>
    );

    const closeButton = await screen.findByRole("button", { name: /close/i });
    expect(closeButton).toBeDisabled();
  });
});
