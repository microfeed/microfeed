/** @jest-environment jsdom */
import React from "react";
import {render, screen} from "@testing-library/react";
import TypeListingPage from "./TypeListingPage";

describe("TypeListingPage", () => {
  test("renders N cards for N items and the type label as heading", () => {
    render(
      <TypeListingPage
        typeLabel="Blog"
        items={[
          {content_type: "blog_article", slug: "one", title: "One"},
          {content_type: "blog_article", slug: "two", title: "Two"},
          {content_type: "blog_article", slug: "three", title: "Three"},
        ]}
        navTypes={[]}
        channel={{title: "My Feed"}}
      />,
    );

    expect(screen.getByRole("heading", {name: "Blog"})).toBeInTheDocument();
    expect(screen.getByRole("link", {name: /One/})).toHaveAttribute("href", "/blog/one");
    expect(screen.getByRole("link", {name: /Two/})).toHaveAttribute("href", "/blog/two");
    expect(screen.getByRole("link", {name: /Three/})).toHaveAttribute("href", "/blog/three");
  });

  test("shows an empty state when there are no items", () => {
    render(
      <TypeListingPage
        typeLabel="Photos"
        items={[]}
        navTypes={[]}
        channel={{title: "My Feed"}}
      />,
    );

    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
  });

  test("renders next control when a next cursor is present", () => {
    render(
      <TypeListingPage
        typeLabel="Blog"
        items={[{content_type: "blog_article", slug: "one", title: "One"}]}
        navTypes={[]}
        channel={{title: "My Feed"}}
        nextCursor={1234}
      />,
    );

    expect(screen.getByRole("link", {name: /next/i})).toHaveAttribute("href", expect.stringContaining("next_cursor=1234"));
    expect(screen.queryByRole("link", {name: /previous/i})).not.toBeInTheDocument();
  });

  test("renders previous control when a prev cursor is present", () => {
    render(
      <TypeListingPage
        typeLabel="Blog"
        items={[{content_type: "blog_article", slug: "one", title: "One"}]}
        navTypes={[]}
        channel={{title: "My Feed"}}
        prevCursor={5678}
      />,
    );

    expect(screen.getByRole("link", {name: /previous/i})).toHaveAttribute("href", expect.stringContaining("prev_cursor=5678"));
  });

  test("nav is present with navTypes links", () => {
    render(
      <TypeListingPage
        typeLabel="Blog"
        items={[]}
        navTypes={[{name: "photo", label: "Photos", href: "/photo/"}]}
        channel={{title: "My Feed"}}
      />,
    );

    expect(screen.getByRole("link", {name: "Photos"})).toHaveAttribute("href", "/photo/");
  });
});
