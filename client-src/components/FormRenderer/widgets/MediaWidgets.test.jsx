/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormRenderer from "../index";
import { getFieldDefs } from "../../../../edge-src/registry/ContentTypeRegistry";
import ImageUploadWidget from "./ImageUploadWidget";
import MediaUploadWidget from "./MediaUploadWidget";
import { mediaWidgets } from "./index";
import Requests from "../../../common/requests";
import Cropper from "cropperjs";

jest.mock("../../../common/requests", () => ({
  __esModule: true,
  default: { upload: jest.fn() },
}));

jest.mock("cropperjs", () => jest.fn());

const PUBLIC_BUCKET_URL = "https://cdn.example.com";

beforeAll(() => {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = jest.fn(() => "blob:mock");
  } else {
    jest.spyOn(window.URL, "createObjectURL").mockImplementation(() => "blob:mock");
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn();
  } else {
    jest.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
  }
});

afterAll(() => {
  if (window.URL.createObjectURL && window.URL.createObjectURL.mockRestore) {
    window.URL.createObjectURL.mockRestore();
  }
  if (window.URL.revokeObjectURL && window.URL.revokeObjectURL.mockRestore) {
    window.URL.revokeObjectURL.mockRestore();
  }
});

function makeFile(name, type) {
  return new File(["dummy content"], name, { type });
}

describe("ImageUploadWidget", () => {
  beforeEach(() => {
    Requests.upload.mockReset();
    Cropper.mockReset();
    Cropper.mockImplementation(() => ({
      getImageData: jest.fn(() => ({ naturalWidth: 1200, naturalHeight: 900 })),
      getCroppedCanvas: jest.fn(() => ({
        toBlob: (cb) => cb(new Blob(["cropped"], { type: "image/avif" })),
      })),
      disable: jest.fn(),
      destroy: jest.fn(),
      setCropBoxData: jest.fn(),
    }));
  });

  test("selecting a file calls Requests.upload and onChange fires with the returned url; preview then appears using publicBucketUrl", async () => {
    Requests.upload.mockImplementation((file, cdnFilename, onProgress, onUploaded) => {
      onProgress(1);
      onUploaded(`production/${cdnFilename}`);
    });

    const user = userEvent.setup();
    const handleChange = jest.fn();
    const fieldDef = { key: "image", kind: "image", label: "Image" };

    const { container } = render(
      <ImageUploadWidget
        fieldDef={fieldDef}
        value={undefined}
        onChange={handleChange}
        error={null}
        publicBucketUrl={PUBLIC_BUCKET_URL}
      />
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    const file = makeFile("photo.png", "image/png");
    await fireEvent.change(input, { target: { files: [file] } });

    const previewImage = await screen.findByRole("img");
    fireEvent.load(previewImage);

    const uploadButton = await screen.findByRole("button", { name: /^upload$/i });
    await user.click(uploadButton);

    expect(Requests.upload).toHaveBeenCalledTimes(1);
    const [, cdnFilename] = Requests.upload.mock.calls[0];
    expect(cdnFilename).toMatch(/^images\/.+\.avif$/);

    await waitFor(() => expect(handleChange).toHaveBeenCalledWith(`production/${cdnFilename}`));
  });

  test("existing value renders the preview and remove calls onChange(undefined)", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    const fieldDef = { key: "image", kind: "image", label: "Image" };

    render(
      <ImageUploadWidget
        fieldDef={fieldDef}
        value="production/images/abc.png"
        onChange={handleChange}
        error={null}
        publicBucketUrl={PUBLIC_BUCKET_URL}
      />
    );

    const img = screen.getByRole("img");
    expect(img.src).toBe(`${PUBLIC_BUCKET_URL}/production/images/abc.png`);

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await user.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith(undefined);
  });
});

describe("MediaUploadWidget", () => {
  beforeEach(() => {
    Requests.upload.mockReset();
  });

  test("file upload detects category from extension and onChange is called with category/url", async () => {
    Requests.upload.mockImplementation((file, cdnFilename, onProgress, onUploaded) => {
      onProgress(1);
      onUploaded(`production/${cdnFilename}`);
    });

    const handleChange = jest.fn();
    const fieldDef = { key: "attachment", kind: "media", label: "Attachment" };

    const { container } = render(
      <MediaUploadWidget
        fieldDef={fieldDef}
        value={undefined}
        onChange={handleChange}
        error={null}
        publicBucketUrl={PUBLIC_BUCKET_URL}
      />
    );

    const input = container.querySelector('input[type="file"]');
    const file = makeFile("episode.mp3", "audio/mpeg");
    Object.defineProperty(file, "size", { value: 12345 });

    await fireEvent.change(input, { target: { files: [file] } });

    expect(Requests.upload).toHaveBeenCalledTimes(1);
    const [, cdnFilename] = Requests.upload.mock.calls[0];
    expect(cdnFilename).toMatch(/^media\/.+\.mp3$/);

    await waitFor(() =>
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "audio",
          url: `production/${cdnFilename}`,
        })
      )
    );
  });

  test("external-url mode emits category external_url with the entered url", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    const fieldDef = { key: "attachment", kind: "media", label: "Attachment" };

    render(
      <MediaUploadWidget
        fieldDef={fieldDef}
        value={undefined}
        onChange={handleChange}
        error={null}
        publicBucketUrl={PUBLIC_BUCKET_URL}
      />
    );

    const externalUrlToggle = screen.getByRole("button", { name: /external url/i });
    await user.click(externalUrlToggle);

    const urlInput = screen.getByPlaceholderText(/https:\/\//i);
    await user.type(urlInput, "https://example.com/audio.mp3");

    const useUrlButton = screen.getByRole("button", { name: /^use url$/i });
    await user.click(useUrlButton);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "external_url",
        url: "https://example.com/audio.mp3",
      })
    );
  });
});

describe("mediaWidgets registration via FormRenderer", () => {
  function Wrapper({ fieldDefs, initialValue = {} }) {
    const [value, setValue] = React.useState(initialValue);
    return (
      <FormRenderer
        fieldDefs={fieldDefs}
        value={value}
        onChange={setValue}
        widgets={mediaWidgets(PUBLIC_BUCKET_URL)}
      />
    );
  }

  test("photo fieldDefs render the real ImageUploadWidget (not the fallback placeholder)", () => {
    const fieldDefs = getFieldDefs("photo");
    const { container } = render(<Wrapper fieldDefs={fieldDefs} initialValue={{}} />);

    expect(screen.queryByText(/image field.*coming soon/i)).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  test("podcast_episode fieldDefs render the real MediaUploadWidget for attachment (not the fallback placeholder)", () => {
    const fieldDefs = getFieldDefs("podcast_episode");
    render(<Wrapper fieldDefs={fieldDefs} initialValue={{}} />);

    expect(screen.queryByText(/media field.*coming soon/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /external url/i })).toBeInTheDocument();
  });
});
