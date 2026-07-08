/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TagsWidget from "./TagsWidget";
import FormRenderer from "../index";
import { tagsWidget } from "./index";
import { getFieldDefs } from "../../../../edge-src/registry/ContentTypeRegistry";
import Requests from "../../../common/requests";

jest.mock("../../../common/requests", () => ({
  __esModule: true,
  default: {
    axiosGet: jest.fn(),
    axiosPost: jest.fn(),
  },
}));

const TAGS = [
  { id: "t1", name: "News", slug: "news" },
  { id: "t2", name: "Launch", slug: "launch" },
];

beforeEach(() => {
  Requests.axiosGet.mockReset();
  Requests.axiosPost.mockReset();
  Requests.axiosGet.mockResolvedValue({ data: { tags: TAGS } });
});

describe("TagsWidget", () => {
  test("loads and renders existing tags; with value:['t1'] shows News selected", async () => {
    const fieldDef = { key: "tags", kind: "tags", label: "Tags" };
    const handleChange = jest.fn();

    render(
      <TagsWidget fieldDef={fieldDef} value={["t1"]} onChange={handleChange} error={null} />
    );

    expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/tags");
    expect(await screen.findByText("News")).toBeInTheDocument();
  });

  test("selecting another tag calls onChange with the updated id array", async () => {
    const user = userEvent.setup();
    const fieldDef = { key: "tags", kind: "tags", label: "Tags" };
    const handleChange = jest.fn();

    const { container } = render(
      <TagsWidget fieldDef={fieldDef} value={["t1"]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());
    expect(await screen.findByText("News")).toBeInTheDocument();

    const input = container.querySelector("input");
    await user.click(input);
    await user.type(input, "Launch");
    const option = await screen.findByText("Launch");
    await user.click(option);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(expect.arrayContaining(["t1", "t2"]));
    });
    const lastCallArg = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCallArg.sort()).toEqual(["t1", "t2"]);
  });

  test("inline-add: creating a new tag calls axiosPost and then onChange includes the new tag id", async () => {
    const user = userEvent.setup();
    Requests.axiosPost.mockResolvedValue({ data: { tag: { id: "t3", name: "Fresh", slug: "fresh" } } });

    const fieldDef = { key: "tags", kind: "tags", label: "Tags" };
    const handleChange = jest.fn();

    const { container } = render(
      <TagsWidget fieldDef={fieldDef} value={[]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());

    const input = container.querySelector("input");
    await user.click(input);
    await user.type(input, "Fresh");

    const createOption = await screen.findByText(/create.*"Fresh"/i);
    await user.click(createOption);

    await waitFor(() => {
      expect(Requests.axiosPost).toHaveBeenCalledWith("/admin/ajax/tags", { name: "Fresh" });
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(expect.arrayContaining(["t3"]));
    });
  });

  test("on create error (400), surfaces the error near the widget", async () => {
    const user = userEvent.setup();
    Requests.axiosPost.mockRejectedValue({
      response: { status: 400, data: { errors: [{ field: "slug", message: "Slug already exists" }] } },
    });

    const fieldDef = { key: "tags", kind: "tags", label: "Tags" };
    const handleChange = jest.fn();

    const { container } = render(
      <TagsWidget fieldDef={fieldDef} value={[]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());

    const input = container.querySelector("input");
    await user.click(input);
    await user.type(input, "News Dup");

    const createOption = await screen.findByText(/create.*"News Dup"/i);
    await user.click(createOption);

    expect(await screen.findByText("Slug already exists")).toBeInTheDocument();
  });

  test("shows the field label and error beneath the widget", async () => {
    const fieldDef = { key: "tags", kind: "tags", label: "Tags", required: true };
    const error = { field: "tags", message: "Tags are invalid" };

    render(<TagsWidget fieldDef={fieldDef} value={[]} onChange={jest.fn()} error={error} />);

    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Tags are invalid")).toBeInTheDocument();
    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());
  });

  test("via FormRenderer with widgets={tagsWidget()} the tags field renders the real TagsWidget (not the fallback placeholder)", async () => {
    const user = userEvent.setup();
    const fieldDefs = getFieldDefs("blog_article");

    const { container } = render(
      <FormRenderer
        fieldDefs={fieldDefs}
        value={{}}
        onChange={jest.fn()}
        widgets={tagsWidget()}
      />
    );

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/tags"));
    expect(screen.queryByText(/tags field.*coming soon/i)).not.toBeInTheDocument();

    const selectContainer = screen.getByText("tags").closest("div");
    const input = selectContainer.parentElement.querySelector("input");
    await user.click(input);

    expect(await screen.findByText("News")).toBeInTheDocument();
  });
});
