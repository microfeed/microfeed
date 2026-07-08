/** @jest-environment jsdom */
import React from "react";
import {render, screen} from "@testing-library/react";
import HomePage from "./HomePage";

describe("HomePage", () => {
  test("hero shows channel image, title, and description; nav present", () => {
    render(
      <HomePage
        channel={{
          title: "My Test Feed",
          description: "A feed about testing",
          image: "https://cdn.example.com/banner.png",
        }}
        items={[]}
        navTypes={[{name: "blog_article", label: "Blog", href: "/blog/"}]}
      />,
    );

    expect(screen.getByRole("heading", {name: "My Test Feed"})).toBeInTheDocument();
    expect(screen.getByText("A feed about testing")).toBeInTheDocument();
    const banner = screen.getAllByRole("img").find((img) => img.getAttribute("src") === "https://cdn.example.com/banner.png");
    expect(banner).toBeTruthy();
    expect(screen.getByRole("link", {name: "Blog"})).toHaveAttribute("href", "/blog/");
  });

  test("text-only hero when channel.image is empty", () => {
    render(
      <HomePage
        channel={{title: "My Test Feed", description: "A feed about testing", image: ""}}
        items={[]}
        navTypes={[]}
      />,
    );

    expect(screen.getByRole("heading", {name: "My Test Feed"})).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("feed renders one card per item with correct href and type badge", () => {
    render(
      <HomePage
        channel={{title: "My Test Feed"}}
        items={[
          {content_type: "blog_article", slug: "article-one", title: "Article One"},
          {content_type: "photo", slug: "photo-one", caption: "Photo One"},
          {content_type: "podcast_episode", slug: "cast-episode", title: "Cast Episode"},
        ]}
        navTypes={[]}
      />,
    );

    expect(screen.getByRole("link", {name: /Article One/})).toHaveAttribute("href", "/blog/article-one");
    expect(screen.getByRole("link", {name: /Photo One/})).toHaveAttribute("href", "/photo/photo-one");
    expect(screen.getByRole("link", {name: /Cast Episode/})).toHaveAttribute("href", "/i/cast-episode");
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getByText("Photo")).toBeInTheDocument();
    expect(screen.getByText("Podcast")).toBeInTheDocument();
  });

  test("hybrid home page renders hero, channel toggles, and configured sections", () => {
    render(
      <HomePage
        channel={{
          title: "My Test Feed",
          description: "A feed about testing",
          image: "https://cdn.example.com/channel.png",
        }}
        homePage={{
          title: "Welcome Home",
          content_html: "<p>Hero body</p>",
          image: "https://cdn.example.com/home.png",
          show_channel_title: true,
          show_channel_description: true,
          show_channel_image: true,
          recent_show_date: true,
          recent_show_excerpt: false,
          recent_show_badge: false,
          featured_title: "Featured picks",
          filtered_title: "Tagged picks",
        }}
        recentItems={[
          {
            content_type: "photo",
            slug: "recent-photo",
            title: "Recent Photo",
            date_published_ms: Date.UTC(2024, 0, 1),
          },
        ]}
        featuredItems={[
          {
            content_type: "blog_article",
            slug: "featured-story",
            title: "Featured Story",
            content_html: "<p>Featured</p>",
          },
        ]}
        filteredItems={[
          {
            content_type: "blog_article",
            slug: "filtered-story",
            title: "Filtered Story",
            content_html: "<p>Filtered</p>",
          },
        ]}
        navTypes={[]}
      />,
    );

    expect(screen.getByRole("heading", {name: "Welcome Home"})).toBeInTheDocument();
    expect(screen.getByText("Hero body")).toBeInTheDocument();
    expect(screen.getByText("A feed about testing")).toBeInTheDocument();
    expect(screen.getByText("Featured picks")).toBeInTheDocument();
    expect(screen.getByText("Tagged picks")).toBeInTheDocument();
    expect(screen.getByText("Recent Photo")).toBeInTheDocument();
    expect(screen.getByText("Featured Story")).toBeInTheDocument();
    expect(screen.getByText("Filtered Story")).toBeInTheDocument();
    expect(screen.queryByText("No recent items yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Read next")).not.toBeInTheDocument();
  });
});
