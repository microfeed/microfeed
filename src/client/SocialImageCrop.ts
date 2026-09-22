export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Called only on the cropped canvas: originals never leave the browser. */
export async function encodeSocialCrop(canvas: HTMLCanvasElement): Promise<Blob> {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the image.");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index]! < 255) { transparent = true; break; }
  }
  const type = transparent ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("Could not prepare the image. Try another file.");
  if (blob.size >= SOCIAL_IMAGE_MAX_BYTES) throw new Error("The crop must be smaller than 5 MB. Try a simpler image.");
  return blob;
}
