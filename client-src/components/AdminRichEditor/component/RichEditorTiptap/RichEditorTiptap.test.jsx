/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RichEditorTiptap from "./index";

describe("RichEditorTiptap", () => {
  it("renders the given HTML value", () => {
    render(<RichEditorTiptap value="<p>Some content</p>" onChange={() => {}} />);

    expect(screen.getByText("Some content")).toBeInTheDocument();
  });

  it("renders the must-have toolbar controls", () => {
    render(<RichEditorTiptap value="<p>Some content</p>" onChange={() => {}} />);

    [
      /h1/i,
      /h2/i,
      /h3/i,
      /h4/i,
      /h5/i,
      /h6/i,
      /bold/i,
      /italic/i,
      /underline/i,
      /strike/i,
      /blockquote/i,
      /code block/i,
      /bullet list/i,
      /ordered list/i,
      /task list/i,
      /horizontal rule/i,
      /image/i,
      /align left/i,
      /align center/i,
      /align right/i,
      /justify/i,
      /undo/i,
      /redo/i,
      /highlight/i,
    ].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("opens the media dialog and inserts an image URL, calling onChange with it included", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <RichEditorTiptap
        value="<p>Some content</p>"
        onChange={onChange}
        extra={{ publicBucketUrl: "https://cdn.example.com", folderName: "items/1" }}
      />
    );

    const imageButton = screen.getByRole("button", { name: /^image$/i });
    await user.click(imageButton);

    const urlModeRadio = screen.getByRole("radio", { name: /from url/i });
    await user.click(urlModeRadio);

    const urlInput = screen.getByPlaceholderText(/example\.com/i);
    await user.type(urlInput, "https://example.com/photo.jpg");

    const insertButton = screen.getByRole("button", { name: /insert/i });
    await user.click(insertButton);

    await waitFor(() => {
      const found = onChange.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("https://example.com/photo.jpg")
      );
      expect(found).toBe(true);
    });
  });
});
