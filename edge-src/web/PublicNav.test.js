/** @jest-environment jsdom */
import React from "react";
import {render, screen} from "@testing-library/react";
import PublicNav from "./PublicNav";

describe("PublicNav", () => {
  test("renders brand image linking home when channel.image is set", () => {
    render(
      <PublicNav
        channel={{title: "My Feed", image: "https://cdn.example.com/logo.png"}}
        navTypes={[]}
      />,
    );

    const brandLink = screen.getByRole("link", {name: /my feed/i});
    expect(brandLink).toHaveAttribute("href", "/");
    const logo = screen.getByRole("img");
    expect(logo).toHaveAttribute("src", "https://cdn.example.com/logo.png");
    expect(logo).toHaveClass("public-nav__logo");
    expect(logo.parentElement).toHaveClass("public-nav__logo-box");
  });

  test("falls back to channel title text when channel.image is empty", () => {
    render(<PublicNav channel={{title: "My Feed", image: ""}} navTypes={[]} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const brandLink = screen.getByRole("link", {name: "My Feed"});
    expect(brandLink).toHaveAttribute("href", "/");
  });

  test("renders exactly the links passed in navTypes", () => {
    render(
      <PublicNav
        channel={{title: "My Feed"}}
        navTypes={[
          {name: "blog_article", label: "Blog", href: "/blog/"},
          {name: "photo", label: "Photos", href: "/photo/"},
        ]}
      />,
    );

    const blogLink = screen.getByRole("link", {name: "Blog"});
    expect(blogLink).toHaveAttribute("href", "/blog/");
    const photosLink = screen.getByRole("link", {name: "Photos"});
    expect(photosLink).toHaveAttribute("href", "/photo/");
    expect(screen.queryByRole("link", {name: "Podcast"})).not.toBeInTheDocument();
  });

  test("renders brand-only when navTypes is empty", () => {
    render(<PublicNav channel={{title: "My Feed"}} navTypes={[]} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
  });

  test("renders a mixed record + Galleries + landing-page link array with unique keys and correct hrefs", () => {
    render(
      <PublicNav
        channel={{title: "My Feed"}}
        navTypes={[
          {name: "blog_article", label: "Blog", href: "/blog/"},
          {name: "gallery", label: "Galleries", href: "/gallery/"},
          {name: "landing:about", label: "About", href: "/about"},
        ]}
      />,
    );

    const blogLink = screen.getByRole("link", {name: "Blog"});
    expect(blogLink).toHaveAttribute("href", "/blog/");
    const galleriesLink = screen.getByRole("link", {name: "Galleries"});
    expect(galleriesLink).toHaveAttribute("href", "/gallery/");
    const aboutLink = screen.getByRole("link", {name: "About"});
    expect(aboutLink).toHaveAttribute("href", "/about");

    // brand link + 3 nav links, all rendered without React key warnings/dupes.
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});
