/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TagManager from "./TagManager";
import Requests from "../common/requests";

jest.mock("../common/requests", () => ({
  axiosGet: jest.fn(),
  axiosPost: jest.fn(),
  axiosPut: jest.fn(),
  axiosDelete: jest.fn(),
}));

describe("TagManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
  });

  it("loads and renders tags on mount", async () => {
    Requests.axiosGet.mockResolvedValueOnce({
      data: { tags: [
        { id: "id1", name: "Cooking", slug: "cooking" },
        { id: "id2", name: "Travel", slug: "travel" },
      ] },
    });

    render(<TagManager />);

    expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/tags/");
    expect(await screen.findByText("Cooking")).toBeInTheDocument();
    expect(screen.getByText("cooking")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByText("travel")).toBeInTheDocument();
  });

  it("creates a tag via the Add tag button", async () => {
    Requests.axiosGet.mockResolvedValueOnce({ data: { tags: [] } });
    Requests.axiosPost.mockResolvedValueOnce({
      data: { tag: { id: "id3", name: "Music", slug: "music" } },
    });
    const user = userEvent.setup();

    render(<TagManager />);
    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/new tag name/i);
    await user.type(input, "Music");
    await user.click(screen.getByRole("button", { name: /add tag/i }));

    await waitFor(() => {
      expect(Requests.axiosPost).toHaveBeenCalledWith("/admin/ajax/tags/", { name: "Music" });
    });
    expect(await screen.findByText("Music")).toBeInTheDocument();
  });

  it("surfaces a create error near the input", async () => {
    Requests.axiosGet.mockResolvedValueOnce({ data: { tags: [] } });
    Requests.axiosPost.mockRejectedValueOnce({
      response: { status: 400, data: { errors: [{ field: "slug", message: "Slug already exists" }] } },
    });
    const user = userEvent.setup();

    render(<TagManager />);
    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/new tag name/i);
    await user.type(input, "News");
    await user.click(screen.getByRole("button", { name: /add tag/i }));

    expect(await screen.findByText("Slug already exists")).toBeInTheDocument();
  });

  it("deletes a tag and removes the row", async () => {
    Requests.axiosGet.mockResolvedValueOnce({
      data: { tags: [{ id: "id1", name: "Cooking", slug: "cooking" }] },
    });
    Requests.axiosDelete.mockResolvedValueOnce({ data: { id: "id1" } });
    const user = userEvent.setup();

    render(<TagManager />);
    expect(await screen.findByText("Cooking")).toBeInTheDocument();

    const row = screen.getByText("Cooking").closest("li");
    await user.click(within(row).getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(Requests.axiosDelete).toHaveBeenCalledWith("/admin/ajax/tags/id1/");
    });
    await waitFor(() => {
      expect(screen.queryByText("Cooking")).not.toBeInTheDocument();
    });
  });

  it("renames a tag inline", async () => {
    Requests.axiosGet.mockResolvedValueOnce({
      data: { tags: [{ id: "id1", name: "Cooking", slug: "cooking" }] },
    });
    Requests.axiosPut.mockResolvedValueOnce({
      data: { tag: { id: "id1", name: "Cuisine", slug: "cuisine" } },
    });
    const user = userEvent.setup();

    render(<TagManager />);
    const row = (await screen.findByText("Cooking")).closest("li");
    await user.click(within(row).getByRole("button", { name: /edit/i }));

    const editInput = within(row).getByDisplayValue("Cooking");
    await user.clear(editInput);
    await user.type(editInput, "Cuisine");
    await user.click(within(row).getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(Requests.axiosPut).toHaveBeenCalledWith("/admin/ajax/tags/id1/", { name: "Cuisine" });
    });
    expect(await screen.findByText("Cuisine")).toBeInTheDocument();
  });
});
