/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormRenderer from "./index";
import { getFieldDefs } from "../../../edge-src/registry/ContentTypeRegistry";

function Wrapper({ fieldDefs, initialValue = {}, errors = [], widgets }) {
  const [value, setValue] = React.useState(initialValue);
  return (
    <FormRenderer
      fieldDefs={fieldDefs}
      value={value}
      onChange={setValue}
      errors={errors}
      widgets={widgets}
    />
  );
}

describe("FormRenderer", () => {
  test("renders a text input for title, a richtext editor for content_html, and a fallback placeholder for tags", () => {
    const fieldDefs = getFieldDefs("blog_article");
    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{ title: "My post", content_html: "<p>Hello</p>" }}
      />
    );

    expect(screen.getByDisplayValue("My post")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText(/tags field.*coming soon/i)).toBeInTheDocument();
  });

  test("shows a required marker on required fields but not on optional ones", () => {
    const fieldDefs = getFieldDefs("blog_article");
    render(<Wrapper fieldDefs={fieldDefs} initialValue={{}} />);

    // title is required (exact match: blog_article also has an unrelated
    // "seo_title" field whose label would otherwise substring-match "title").
    const titleLabel = screen.getByText("title", { exact: true });
    expect(titleLabel.textContent).toMatch(/\*/);

    // author is optional
    const authorLabel = screen.getByText("author", { exact: true });
    expect(authorLabel.textContent).not.toMatch(/\*/);
  });

  test("editing the title input calls onChange with the full payload including the new title", async () => {
    const user = userEvent.setup();
    const fieldDefs = getFieldDefs("blog_article");
    const handleChange = jest.fn();

    render(
      <FormRenderer
        fieldDefs={fieldDefs}
        value={{ title: "Hi", author: "Jane" }}
        onChange={handleChange}
        errors={[]}
      />
    );

    const titleInput = screen.getByDisplayValue("Hi");
    await user.type(titleInput, "!");

    expect(handleChange).toHaveBeenCalled();
    const lastCallArg = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCallArg.author).toBe("Jane");
    expect(lastCallArg.title).toBe("Hi!");
  });

  test("renders an error message near the field it belongs to", () => {
    const fieldDefs = getFieldDefs("blog_article");
    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{}}
        errors={[{ field: "title", message: "Title is required" }]}
      />
    );

    expect(screen.getByText("Title is required")).toBeInTheDocument();
  });

  test("blog_article rich text fields keep HTML source mode available", () => {
    const fieldDefs = getFieldDefs("blog_article");
    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{ content_html: "<p>Hello</p>" }}
      />
    );

    expect(screen.getByRole("radio", { name: /html source/i })).toBeInTheDocument();
  });

  test("gallery rich text fields hide HTML source mode", () => {
    const fieldDefs = getFieldDefs("gallery");
    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{ content_html: "<p>Hello</p>" }}
      />
    );

    expect(screen.queryByRole("radio", { name: /html source/i })).not.toBeInTheDocument();
  });

  test("renders an enum field as a select with the right options and updates the payload on change", async () => {
    const user = userEvent.setup();
    const fieldDefs = getFieldDefs("podcast_episode");
    const handleChange = jest.fn();

    // itunes:episodeType's feedMapping.source is nested under _microfeed, so
    // the form value uses that shape (matching the API / public-item shape).
    render(
      <FormRenderer
        fieldDefs={fieldDefs}
        value={{ title: "Ep 1", _microfeed: { "itunes:episodeType": "full" } }}
        onChange={handleChange}
        errors={[]}
      />
    );

    expect(screen.getByText("full")).toBeInTheDocument();

    const control = screen.getByText("full");
    await user.click(control);
    const trailerOption = await screen.findByText("trailer");
    await user.click(trailerOption);

    expect(handleChange).toHaveBeenCalled();
    const lastCallArg = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCallArg._microfeed["itunes:episodeType"]).toBe("trailer");
    expect(lastCallArg.title).toBe("Ep 1");
  });

  test("a boolean field whose source differs from its key (show_in_nav -> showInNav) reads and writes the source key", async () => {
    const user = userEvent.setup();
    const fieldDefs = getFieldDefs("landing_page");
    const handleChange = jest.fn();

    // Value uses the source key (showInNav) — what the API/public item uses.
    render(
      <FormRenderer
        fieldDefs={fieldDefs}
        value={{ title: "LP", showInNav: true }}
        onChange={handleChange}
        errors={[]}
      />
    );

    // The switch reflects the source-keyed value (on).
    const toggle = screen.getByRole("switch", {name: /show in site navigation/i});
    expect(toggle).toBeChecked();

    await user.click(toggle);
    const lastCallArg = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    // onChange writes back to showInNav (source), not show_in_nav (key).
    expect(lastCallArg.showInNav).toBe(false);
    expect(lastCallArg).not.toHaveProperty("show_in_nav");
    expect(lastCallArg.title).toBe("LP");
  });

  test("widgets prop override seam: passing widgets={{tags: MyTagWidget}} renders MyTagWidget instead of the fallback", () => {
    const fieldDefs = getFieldDefs("blog_article");
    function MyTagWidget({ fieldDef, value, onChange, error }) {
      return <div data-testid="my-tag-widget">custom tags widget for {fieldDef.key}</div>;
    }

    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{ tags: ["a", "b"] }}
        widgets={{ tags: MyTagWidget }}
      />
    );

    expect(screen.getByTestId("my-tag-widget")).toBeInTheDocument();
    expect(screen.queryByText(/tags field.*coming soon/i)).not.toBeInTheDocument();
  });

  test("kind-keyed widget still works when there is no per-key override for that field", () => {
    const fieldDefs = getFieldDefs("landing_page");
    function MyStringListWidget({ fieldDef }) {
      return <div data-testid="kind-widget">kind widget for {fieldDef.key}</div>;
    }

    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{ filter_tags: ["a"] }}
        widgets={{ string_list: MyStringListWidget }}
      />
    );

    expect(screen.getByTestId("kind-widget")).toBeInTheDocument();
    expect(screen.getByText("kind widget for filter_tags")).toBeInTheDocument();
  });

  test("a per-key widget takes precedence over a kind-keyed widget for the same field", () => {
    const fieldDefs = getFieldDefs("landing_page");
    function KindWidget() {
      return <div data-testid="kind-widget">kind widget</div>;
    }
    function KeyWidget({ fieldDef }) {
      return <div data-testid="key-widget">key widget for {fieldDef.key}</div>;
    }

    render(
      <Wrapper
        fieldDefs={fieldDefs}
        initialValue={{ filter_tags: ["a"] }}
        widgets={{ string_list: KindWidget, filter_tags: KeyWidget }}
      />
    );

    expect(screen.getByTestId("key-widget")).toBeInTheDocument();
    expect(screen.getByText("key widget for filter_tags")).toBeInTheDocument();
    expect(screen.queryByTestId("kind-widget")).not.toBeInTheDocument();
  });
});
