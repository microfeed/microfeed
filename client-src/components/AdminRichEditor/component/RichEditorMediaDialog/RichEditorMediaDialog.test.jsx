/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RichEditorMediaDialog from "./index";
import Requests from "../../../../common/requests";

jest.mock("react-drag-drop-files", () => ({
  FileUploader: ({ handleChange, children, disabled }) => (
    <div>
      <input
        aria-label="file uploader"
        disabled={disabled}
        type="file"
        onChange={(e) => handleChange(e.target.files[0])}
      />
      {children}
    </div>
  ),
}));

jest.mock("../../../../common/requests", () => ({
  __esModule: true,
  default: {
    upload: jest.fn(),
  },
}));

describe("RichEditorMediaDialog", () => {
  beforeEach(() => {
    Requests.upload.mockReset();
    Requests.upload.mockImplementation((file, cdnFilename, onProgress, onUploaded) => {
      onProgress(1);
      onUploaded(`production/${cdnFilename}`);
    });
  });

  it("routes image uploads through the shared image pipeline", async () => {
    const onInsert = jest.fn();
    const setIsOpen = jest.fn();

    render(
      <RichEditorMediaDialog
        isOpen
        setIsOpen={setIsOpen}
        mediaType="image"
        onInsert={onInsert}
        extra={{ publicBucketUrl: "https://cdn.example.com", folderName: "items/1" }}
      />
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = screen.getByLabelText(/file uploader/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(Requests.upload).toHaveBeenCalled());

    const [, cdnFilename] = Requests.upload.mock.calls[0];
    expect(cdnFilename).toMatch(/^images\/.+\.avif$/);
    expect(onInsert).toHaveBeenCalled();
  });
});
