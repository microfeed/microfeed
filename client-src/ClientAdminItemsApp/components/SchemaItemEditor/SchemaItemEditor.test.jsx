/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SchemaItemEditor from "./index";
import Requests from "../../../common/requests";

jest.mock("../../../common/requests", () => ({
  __esModule: true,
  default: {
    axiosGet: jest.fn(),
    axiosPost: jest.fn(),
    axiosPut: jest.fn(),
  },
}));

beforeEach(() => {
  Requests.axiosGet.mockReset();
  Requests.axiosPost.mockReset();
  Requests.axiosPut.mockReset();
  Requests.axiosGet.mockResolvedValue({ data: { tags: [] } });
  Requests.axiosPost.mockResolvedValue({ data: { items: [] } });
});

describe("SchemaItemEditor", () => {
  async function renderEditor(ui) {
    const result = render(ui);
    await waitFor(() => {
      expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/tags");
    });
    return result;
  }

  test("NEW: filling in title and saving calls axiosPost with content_type + title", async () => {
    const user = userEvent.setup();
    Requests.axiosPost.mockResolvedValue({ status: 201, data: { id: "new-id-123" } });

    await renderEditor(<SchemaItemEditor contentType="blog_article" publicBucketUrl="https://cdn.example.com" />);

    const titleLabel = screen.getByText(/^title/i);
    const titleContainer = titleLabel.closest("label") || titleLabel.parentElement;
    const input = titleContainer.querySelector("input");
    await user.type(input, "My New Post");

    const saveButton = screen.getByRole("button", { name: /save|create/i });
    await user.click(saveButton);

    expect(Requests.axiosPost).toHaveBeenCalledWith(
      "/admin/ajax/items",
      expect.objectContaining({ content_type: "blog_article", title: "My New Post" })
    );
  });

  test("EDIT: pre-populates from item, and saving calls axiosPut to /admin/ajax/items/{id} with updated payload", async () => {
    const user = userEvent.setup();
    Requests.axiosPut.mockResolvedValue({ status: 200, data: { id: "item-1" } });

    const item = {
      id: "item-1",
      content_type: "blog_article",
      title: "Original Title",
      content_html: "<p>Original</p>",
      excerpt: "orig excerpt",
    };

    await renderEditor(
      <SchemaItemEditor
        contentType="blog_article"
        item={item}
        publicBucketUrl="https://cdn.example.com"
      />
    );

    expect(screen.getByDisplayValue("Original Title")).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue("Original Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");

    const saveButton = screen.getByRole("button", { name: /save|update/i });
    await user.click(saveButton);

    expect(Requests.axiosPut).toHaveBeenCalledWith(
      "/admin/ajax/items/item-1",
      expect.objectContaining({ title: "Updated Title" })
    );
  });

  test("400 response with field errors shows the error under the corresponding field", async () => {
    const user = userEvent.setup();
    Requests.axiosPost.mockRejectedValue({
      response: {
        status: 400,
        data: { errors: [{ field: "title", message: "Title is required" }] },
      },
    });

    await renderEditor(<SchemaItemEditor contentType="blog_article" publicBucketUrl="https://cdn.example.com" />);

    const saveButton = screen.getByRole("button", { name: /save|create/i });
    await user.click(saveButton);

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });

  test("landing_page: renders the LandingPreview beneath the form and posts the current payload to the preview endpoint", async () => {
    await renderEditor(<SchemaItemEditor contentType="landing_page" publicBucketUrl="https://cdn.example.com" />);

    await waitFor(() => {
      expect(Requests.axiosPost).toHaveBeenCalledWith(
        "/admin/ajax/aggregation/preview",
        expect.any(Object)
      );
    });
    expect(await screen.findByText(/no items match/i)).toBeInTheDocument();
  });

  test("landing_page: filter_tags uses the tag picker widget (loads tags) instead of the comma-separated fallback", async () => {
    await renderEditor(<SchemaItemEditor contentType="landing_page" publicBucketUrl="https://cdn.example.com" />);

    await waitFor(() => {
      expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/tags");
    });
    expect(screen.queryByPlaceholderText("comma, separated, values")).not.toBeInTheDocument();
  });

  test("non-landing content types do not render the LandingPreview", async () => {
    await renderEditor(<SchemaItemEditor contentType="blog_article" publicBucketUrl="https://cdn.example.com" />);

    expect(screen.queryByText(/no items match/i)).not.toBeInTheDocument();
  });

  test("non-home content types render related items in the metadata rail and preload selected ids", async () => {
    Requests.axiosGet.mockImplementation((url) => {
      if (url === "/admin/ajax/tags") {
        return Promise.resolve({ data: { tags: [] } });
      }
      if (url.startsWith("/admin/ajax/items?content_type__in=")) {
        return Promise.resolve({
          data: {
            items: [
              { id: "related-1", content_type: "blog_article", title: "Related Post", status: "published" },
              { id: "hidden-1", content_type: "photo", title: "Hidden Photo", status: "unpublished" },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    await renderEditor(
      <SchemaItemEditor
        contentType="blog_article"
        item={{
          id: "item-1",
          content_type: "blog_article",
          title: "Post With Relations",
          content_html: "<p>Body</p>",
          related_items: ["related-1"],
        }}
        publicBucketUrl="https://cdn.example.com"
      />
    );

    const metadataRail = screen.getByRole("complementary", { name: /metadata rail/i });
    expect(within(metadataRail).getByText("Related items")).toBeInTheDocument();
    await waitFor(() => expect(Requests.axiosGet).toHaveBeenCalledWith("/admin/ajax/items?content_type__in=podcast_episode,blog_article,photo,gallery,landing_page"));
    expect(await screen.findByText("Related Post")).toBeInTheDocument();
    expect(screen.queryByText("photo: Hidden Photo")).not.toBeInTheDocument();
  });

  test("home_page hides the slug editor and submits without slug", async () => {
    const user = userEvent.setup();
    Requests.axiosPut.mockResolvedValue({ status: 200, data: { id: "home-1" } });

    await renderEditor(
      <SchemaItemEditor
        contentType="home_page"
        item={{
          id: "home-1",
          content_type: "home_page",
          slug: "home",
          title: "Home",
          content_html: "<p>Welcome</p>",
        }}
        publicBucketUrl="https://cdn.example.com"
      />
    );

    const metadataRail = screen.getByRole("complementary", { name: /metadata rail/i });
    expect(within(metadataRail).queryByRole("textbox", { name: /url slug/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("home")).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /save|update/i });
    await user.click(saveButton);

    await waitFor(() => expect(Requests.axiosPut).toHaveBeenCalled());
    const [, payload] = Requests.axiosPut.mock.calls[0];
    expect(payload).not.toHaveProperty("slug");
  });

  test("keeps primary save actions in a sticky editor header and metadata in the right rail", async () => {
    await renderEditor(<SchemaItemEditor contentType="blog_article" publicBucketUrl="https://cdn.example.com" />);

    const header = screen.getByRole("banner", { name: /editor header/i });
    const metadataRail = screen.getByRole("complementary", { name: /metadata rail/i });

    expect(within(header).getByRole("button", { name: /create/i })).toBeInTheDocument();
    expect(within(metadataRail).getByRole("textbox", { name: /url slug/i })).toBeInTheDocument();
    expect(within(metadataRail).getByRole("combobox", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse metadata/i })).toBeInTheDocument();
  });
});
