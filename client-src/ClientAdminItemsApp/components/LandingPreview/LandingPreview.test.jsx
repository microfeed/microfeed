/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import LandingPreview from "./index";
import Requests from "../../../common/requests";

jest.mock("../../../common/requests", () => ({
  __esModule: true,
  default: {
    axiosPost: jest.fn(),
  },
}));

beforeEach(() => {
  Requests.axiosPost.mockReset();
});

describe("LandingPreview", () => {
  test("POSTs the payload to /admin/ajax/aggregation/preview and lists the returned items", async () => {
    Requests.axiosPost.mockResolvedValue({
      data: {
        items: [
          { id: "1", content_type: "blog_article", title: "Hello World" },
          { id: "2", content_type: "photo", title: "A Nice Photo" },
        ],
      },
    });

    const payload = { content_types: ["blog_article"], filter_tags: [], sort: "newest_first", limit: 10 };
    render(<LandingPreview payload={payload} />);

    await waitFor(() => {
      expect(Requests.axiosPost).toHaveBeenCalledWith(
        "/admin/ajax/aggregation/preview",
        payload
      );
    });

    expect(await screen.findByText("Hello World")).toBeInTheDocument();
    expect(await screen.findByText("A Nice Photo")).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  test("re-fetches when the payload changes", async () => {
    Requests.axiosPost.mockResolvedValue({ data: { items: [] } });

    const payload1 = { content_types: ["blog_article"], filter_tags: [], sort: "newest_first" };
    const { rerender } = render(<LandingPreview payload={payload1} />);

    await waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledTimes(1));

    const payload2 = { content_types: ["photo"], filter_tags: [], sort: "newest_first" };
    rerender(<LandingPreview payload={payload2} />);

    await waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledTimes(2));
    expect(Requests.axiosPost).toHaveBeenLastCalledWith(
      "/admin/ajax/aggregation/preview",
      payload2
    );
  });

  test("shows an empty state when there are no matches", async () => {
    Requests.axiosPost.mockResolvedValue({ data: { items: [] } });

    render(<LandingPreview payload={{ content_types: [] }} />);

    expect(await screen.findByText(/no items match/i)).toBeInTheDocument();
  });
});
