/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TypePicker from "./index";
import { listTypes } from "../../../../edge-src/registry/ContentTypeRegistry";

describe("TypePicker", () => {
  test("renders a card/button for every visible registry content type", () => {
    render(<TypePicker onPick={() => {}} />);

    listTypes()
      .filter((typeDef) => typeDef.showInTypePicker !== false)
      .forEach((typeDef) => {
        expect(screen.getByText(new RegExp(typeDef.name.replace(/_/g, "[ _]"), "i"))).toBeInTheDocument();
      });

    expect(screen.queryByTestId("type-picker-card-home_page")).not.toBeInTheDocument();
  });

  test("clicking a type card calls onPick with that type's name", async () => {
    const user = userEvent.setup();
    const handlePick = jest.fn();
    render(<TypePicker onPick={handlePick} />);

    const button = screen.getByTestId("type-picker-card-blog_article");
    await user.click(button);

    expect(handlePick).toHaveBeenCalledWith("blog_article");
  });

  test("groups record types separately from aggregator types", () => {
    render(<TypePicker onPick={() => {}} />);

    expect(screen.getByTestId("type-picker-card-podcast_episode")).toBeInTheDocument();
    expect(screen.getByTestId("type-picker-card-gallery")).toBeInTheDocument();
    expect(screen.getByTestId("type-picker-card-landing_page")).toBeInTheDocument();
  });
});
