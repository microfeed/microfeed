/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GalleryCurator from "./GalleryCurator";
import FormRenderer from "../index";
import { referenceWidget } from "./index";
import { getFieldDefs } from "../../../../edge-src/registry/ContentTypeRegistry";
import Requests from "../../../common/requests";

jest.mock("../../../common/requests", () => ({
  __esModule: true,
  default: {
    axiosGet: jest.fn(),
  },
}));

const PHOTOS = [
  { id: "p1", content_type: "photo", title: "Photo One", image: "https://cdn.example.com/one.jpg" },
  { id: "p2", content_type: "photo", title: "Photo Two", image: "https://cdn.example.com/two.jpg" },
  { id: "p3", content_type: "photo", title: "Photo Three", image: "https://cdn.example.com/three.jpg" },
];

const MIXED_ITEMS = [
  { id: "p1", content_type: "photo", title: "Photo One", image: "https://cdn.example.com/one.jpg" },
  { id: "a1", content_type: "blog_article", title: "Article One" },
];

const RELATED_CONTENT_ITEMS = [
  { id: "p1", content_type: "photo", title: "Photo One", image: "https://cdn.example.com/one.jpg", status: "published" },
  { id: "p2", content_type: "photo", title: "Photo Two", image: "https://cdn.example.com/two.jpg", status: "published" },
  { id: "a1", content_type: "blog_article", title: "Article One", status: "unpublished" },
  { id: "g1", content_type: "gallery", title: "Gallery One", status: "published" },
  { id: "h1", content_type: "home_page", title: "Home Page", status: "published" },
];

beforeEach(() => {
  Requests.axiosGet.mockReset();
  Requests.axiosGet.mockResolvedValue({ data: { items: PHOTOS } });
});

describe("GalleryCurator", () => {
  test("renders current members (value:[p1,p2]) in order", async () => {
    const fieldDef = { key: "members", kind: "reference", label: "Members" };
    const handleChange = jest.fn();

    render(
      <GalleryCurator fieldDef={fieldDef} value={["p1", "p2"]} onChange={handleChange} error={null} />
    );

    expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/items?content_type=photo");

    await waitFor(() => expect(screen.getAllByText("Photo One").length).toBeGreaterThan(0));

    const items = screen.getAllByTestId("gallery-curator-member");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Photo One");
    expect(items[1]).toHaveTextContent("Photo Two");
  });

  test("supports multiple allowed content types via content_type__in", async () => {
    Requests.axiosGet.mockResolvedValueOnce({ data: { items: MIXED_ITEMS } });
    const fieldDef = {
      key: "featured_items",
      kind: "reference",
      label: "Featured items",
      allowedContentTypes: ["photo", "blog_article"],
    };

    render(<GalleryCurator fieldDef={fieldDef} value={[]} onChange={jest.fn()} error={null} />);

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/items?content_type__in=photo,blog_article"));
    expect(await screen.findByRole("option", { name: "photo: Photo One" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "blog_article: Article One" })).toBeInTheDocument();
  });

  test("related-content field filters to published non-home candidates", async () => {
    Requests.axiosGet.mockResolvedValueOnce({ data: { items: RELATED_CONTENT_ITEMS } });
    const fieldDef = {
      key: "related_items",
      kind: "reference",
      label: "Related items",
      allowedContentTypes: [
        "podcast_episode",
        "blog_article",
        "photo",
        "gallery",
        "landing_page",
      ],
      onlyPublished: true,
    };

    render(<GalleryCurator fieldDef={fieldDef} value={["p1"]} onChange={jest.fn()} error={null} />);

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/items?content_type__in=podcast_episode,blog_article,photo,gallery,landing_page"));
    expect(await screen.findByRole("option", { name: "photo: Photo Two" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "blog_article: Article One" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "home_page: Home Page" })).not.toBeInTheDocument();
  });

  test("Move-down on p1 calls onChange([p2, p1])", async () => {
    const user = userEvent.setup();
    const fieldDef = { key: "members", kind: "reference", label: "Members" };
    const handleChange = jest.fn();

    render(
      <GalleryCurator fieldDef={fieldDef} value={["p1", "p2"]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(screen.getAllByText("Photo One").length).toBeGreaterThan(0));

    const items = screen.getAllByTestId("gallery-curator-member");
    const moveDownButton = items[0].querySelector('[aria-label="Move down"]');
    await user.click(moveDownButton);

    expect(handleChange).toHaveBeenCalledWith(["p2", "p1"]);
  });

  test("Move-up on p2 calls onChange([p2, p1])", async () => {
    const user = userEvent.setup();
    const fieldDef = { key: "members", kind: "reference", label: "Members" };
    const handleChange = jest.fn();

    render(
      <GalleryCurator fieldDef={fieldDef} value={["p1", "p2"]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(screen.getAllByText("Photo One").length).toBeGreaterThan(0));

    const items = screen.getAllByTestId("gallery-curator-member");
    const moveUpButton = items[1].querySelector('[aria-label="Move up"]');
    await user.click(moveUpButton);

    expect(handleChange).toHaveBeenCalledWith(["p2", "p1"]);
  });

  test("Remove p1 calls onChange([p2])", async () => {
    const user = userEvent.setup();
    const fieldDef = { key: "members", kind: "reference", label: "Members" };
    const handleChange = jest.fn();

    render(
      <GalleryCurator fieldDef={fieldDef} value={["p1", "p2"]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(screen.getAllByText("Photo One").length).toBeGreaterThan(0));

    const items = screen.getAllByTestId("gallery-curator-member");
    const removeButton = items[0].querySelector('[aria-label="Remove"]');
    await user.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith(["p2"]);
  });

  test("Add p3 (not already a member) calls onChange([...current, p3])", async () => {
    const user = userEvent.setup();
    const fieldDef = { key: "members", kind: "reference", label: "Members" };
    const handleChange = jest.fn();

    render(
      <GalleryCurator fieldDef={fieldDef} value={["p1", "p2"]} onChange={handleChange} error={null} />
    );

    await waitFor(() => expect(screen.getAllByText("Photo One").length).toBeGreaterThan(0));

    const addSelect = screen.getByTestId("gallery-curator-add-select");
    await user.selectOptions(addSelect, "p3");

    expect(handleChange).toHaveBeenCalledWith(["p1", "p2", "p3"]);
  });

  test("shows the field label and error beneath the widget", async () => {
    const fieldDef = { key: "members", kind: "reference", label: "Members", required: true };
    const error = { field: "members", message: "Members are invalid" };

    render(<GalleryCurator fieldDef={fieldDef} value={[]} onChange={jest.fn()} error={error} />);

    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Members are invalid")).toBeInTheDocument();
    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalled());
  });

  test("via FormRenderer with widgets={referenceWidget()} the members field renders the real GalleryCurator (not the fallback placeholder)", async () => {
    const fieldDefs = getFieldDefs("gallery");

    render(
      <FormRenderer
        fieldDefs={fieldDefs}
        value={{ members: ["p1"] }}
        onChange={jest.fn()}
        widgets={referenceWidget()}
      />
    );

    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/items?content_type=photo"));
    expect(screen.queryByText(/reference field.*coming soon/i)).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText("Photo One").length).toBeGreaterThan(0));
  });
});
