import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Requests from "@/client/requests";
import AdminFileUploader from "@/components/admin/shared/AdminFileUploader";
import AdminImageUploaderApp from "@/components/admin/shared/AdminImageUploaderApp";
import {AlertDialog} from "@/components/ui/alert-dialog";
import {DropdownMenu} from "@/components/ui/dropdown-menu";

vi.mock("@/client/ToastUtils", () => ({showToast: vi.fn()}));

function uploaderProps(overrides: Record<string, unknown> = {}) {
  return {
    currentImageUrl: "production/images/channel.png",
    feed: {settings: {webGlobalSettings: {publicBucketUrl: "/media/"}}},
    imageMetadataTarget: {id: "channel-1", type: "channel"},
    mediaStorageReady: true,
    onImageDeleted: vi.fn(),
    onImageUploaded: vi.fn(),
    publicBucketUrl: "/media/",
    ...overrides,
  };
}

function useSynchronousState(component: AdminImageUploaderApp) {
  component.setState = ((update: unknown, callback?: () => void) => {
    const nextState = typeof update === "function"
      ? update(component.state, component.props)
      : update;
    component.state = {...component.state, ...nextState};
    callback?.();
  }) as typeof component.setState;
}

function textContent(value: React.ReactNode): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(" ");
  }
  if (React.isValidElement<{children?: React.ReactNode}>(value)) {
    return textContent(value.props.children);
  }
  return "";
}

function findElement(
  value: React.ReactNode,
  predicate: (element: React.ReactElement<any>) => boolean,
): React.ReactElement<any> | undefined {
  for (const child of React.Children.toArray(value)) {
    if (!React.isValidElement<any>(child)) {
      continue;
    }
    if (predicate(child)) {
      return child;
    }
    const nested = findElement(child.props.children, predicate);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

describe("admin image uploader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", {location: {hostname: "localhost"}});
  });

  it("keeps the direct uploader for an empty image", () => {
    const component = new AdminImageUploaderApp(uploaderProps({
      currentImageUrl: undefined,
    }));
    const tree = component.render();
    const firstChild = React.Children.toArray(tree.props.children)[0] as
      React.ReactElement;

    expect(firstChild.type).toBe(AdminFileUploader);
    expect(renderToStaticMarkup(firstChild)).toContain(
      "Click or drag here to upload image",
    );
  });

  it("replaces the preview link with image actions", () => {
    const component = new AdminImageUploaderApp(uploaderProps());
    const tree = component.render();
    const fragment = React.Children.toArray(tree.props.children)[0] as
      React.ReactElement<{children: React.ReactNode}>;
    const menu = React.Children.toArray(fragment.props.children).find(
      (child) => React.isValidElement(child) && child.type === DropdownMenu,
    );

    expect(menu).toBeTruthy();
    expect(textContent(menu)).toContain("Replace");
    expect(textContent(menu)).toContain("Preview");
    expect(textContent(menu)).toContain("Delete");
    expect(textContent(tree)).not.toContain("preview image");
  });

  it("removes persisted metadata through the delete endpoint", async () => {
    const props = uploaderProps();
    const component = new AdminImageUploaderApp(props);
    useSynchronousState(component);
    const deleteImage = vi.spyOn(Requests, "deleteImage")
      .mockResolvedValue({} as Awaited<ReturnType<typeof Requests.deleteImage>>);

    await component.onDeleteImage();

    expect(deleteImage).toHaveBeenCalledWith(
      "production/images/channel.png",
      {id: "channel-1", type: "channel"},
    );
    expect(props.onImageDeleted).toHaveBeenCalledOnce();
    expect(component.state.currentImageUrl).toBeNull();
  });

  it("requires confirmation before deleting an image", () => {
    const component = new AdminImageUploaderApp(uploaderProps());
    useSynchronousState(component);
    const deleteImage = vi.spyOn(Requests, "deleteImage");
    const initialTree = component.render();
    const deleteMenuItem = findElement(
      initialTree,
      (element) => typeof element.props.onClick === "function" &&
        textContent(element).trim() === "Delete",
    );

    expect(deleteMenuItem).toBeTruthy();
    deleteMenuItem!.props.onClick();

    const confirmation = findElement(
      component.render(),
      (element) => element.type === AlertDialog,
    );
    expect(deleteImage).not.toHaveBeenCalled();
    expect(component.state.showDeleteConfirm).toBe(true);
    expect(confirmation?.props.open).toBe(true);
    expect(textContent(confirmation)).toContain("Delete this image?");
    expect(textContent(confirmation)).toContain("Delete image");
  });

  it("reports the replaced image after a successful upload", async () => {
    const props = uploaderProps();
    const component = new AdminImageUploaderApp(props);
    useSynchronousState(component);
    const blob = new Blob(["image"], {type: "image/png"});
    component.state = {
      ...component.state,
      cdnFilename: "images/replacement.png",
      cropper: {
        destroy: vi.fn(),
        disable: vi.fn(),
        getCroppedCanvas: () => ({
          toBlob: (callback: (value: Blob) => void) => callback(blob),
        }),
      },
    };
    vi.spyOn(Requests, "upload").mockImplementation((
      _file,
      _filename,
      _onProgress,
      onUploaded,
    ) => onUploaded("production/images/replacement.png"));

    await component.onFileUploadToR2();

    expect(props.onImageUploaded).toHaveBeenCalledWith(
      "production/images/replacement.png",
      "image/png",
      "production/images/channel.png",
    );
  });

  it("uploads only the social crop and retains the previous image after an upload failure", async () => {
    const props = uploaderProps({socialImage: true});
    const component = new AdminImageUploaderApp(props);
    useSynchronousState(component);
    const crop = new Blob(["cropped photograph"], {type: "image/jpeg"});
    const cropper = {
      destroy: vi.fn(), disable: vi.fn(), enable: vi.fn(),
      getCroppedCanvas: vi.fn(() => ({
        width: 1200, height: 630,
        getContext: () => ({getImageData: () => ({data: new Uint8ClampedArray([0, 0, 0, 255])})}),
        toBlob: (callback: (blob: Blob) => void) => callback(crop),
      })),
    };
    component.state = {...component.state, cropper, cdnFilename: "images/social.png"};
    const upload = vi.spyOn(Requests, "upload").mockImplementation((_file, _name, _progress, _success, failure) => failure());
    await component.onFileUploadToR2();
    expect(cropper.getCroppedCanvas).toHaveBeenCalledWith({width: 1200, height: 630, imageSmoothingQuality: "high"});
    expect(upload).toHaveBeenCalledWith(crop, "images/social.jpg", expect.any(Function), expect.any(Function), expect.any(Function), expect.any(Function));
    expect(props.onImageUploaded).not.toHaveBeenCalled();
    expect(component.state.currentImageUrl).toBe(props.currentImageUrl);
    expect(component.state.uploadStatus).toBeNull();
    expect(cropper.enable).toHaveBeenCalledOnce();
    expect(cropper.destroy).not.toHaveBeenCalled();
  });

  it("defers social-image deletion to the content save and keeps metadata after a failed removal", async () => {
    const props = uploaderProps({deferredRemoval: true});
    const component = new AdminImageUploaderApp(props);
    useSynchronousState(component);
    const deleteImage = vi.spyOn(Requests, "deleteImage");
    props.onImageDeleted.mockRejectedValueOnce(new Error("save failed"));
    await component.onDeleteImage();
    expect(component.state.currentImageUrl).toBe(props.currentImageUrl);
    await component.onDeleteImage();
    expect(deleteImage).not.toHaveBeenCalled();
    expect(component.state.currentImageUrl).toBeNull();
  });
});
