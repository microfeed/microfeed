/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterTagsWidget from "./FilterTagsWidget";
import Requests from "../../../common/requests";

jest.mock("../../../common/requests", () => ({
  __esModule: true,
  default: {
    axiosGet: jest.fn(),
  },
}));

beforeEach(() => {
  Requests.axiosGet.mockReset();
});

const fieldDef = { key: "filter_tags", kind: "string_list", label: "Filter tags" };

describe("FilterTagsWidget", () => {
  test("loads tags from /admin/ajax/tags on mount and shows a pre-selected tag", async () => {
    Requests.axiosGet.mockResolvedValue({
      data: { tags: [{ id: "t1", name: "Featured" }, { id: "t2", name: "News" }] },
    });

    render(<FilterTagsWidget fieldDef={fieldDef} value={["t1"]} onChange={jest.fn()} />);

    expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/tags");
    expect(await screen.findByText("Featured")).toBeInTheDocument();
  });

  test("selecting a tag emits the plain array of tag ids via onChange", async () => {
    const user = userEvent.setup();
    Requests.axiosGet.mockResolvedValue({
      data: { tags: [{ id: "t1", name: "Featured" }, { id: "t2", name: "News" }] },
    });
    const handleChange = jest.fn();

    const { container } = render(
      <FilterTagsWidget fieldDef={fieldDef} value={[]} onChange={handleChange} />
    );

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());
    const input = container.querySelector("input");
    await user.click(input);
    const option = await screen.findByText("News");
    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith(["t2"]);
  });

  test("pre-selected tag ids render as selected options", async () => {
    Requests.axiosGet.mockResolvedValue({
      data: { tags: [{ id: "t1", name: "Featured" }, { id: "t2", name: "News" }] },
    });

    render(<FilterTagsWidget fieldDef={fieldDef} value={["t1"]} onChange={jest.fn()} />);

    expect(await screen.findByText("Featured")).toBeInTheDocument();
  });
});
