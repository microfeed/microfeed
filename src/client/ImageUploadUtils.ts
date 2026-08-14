/**
 * Convert an image blob to AVIF client-side before it is uploaded to R2.
 *
 * AVIF is the storage format for every image uploaded through the admin UI.
 * Browsers without AVIF encode support silently fall back to the original
 * blob, so callers must check the returned blob's type to know which format
 * was actually produced. Already-AVIF input is returned unchanged so the
 * conversion is idempotent (the cover-art uploader already encodes AVIF).
 */
export async function convertImageToAvif(blob: Blob): Promise<Blob> {
  if (blob.type === "image/avif") {
    return blob;
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return blob;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const avifBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/avif", 0.8);
    });
    return avifBlob && avifBlob.type === "image/avif" ? avifBlob : blob;
  } catch {
    return blob;
  }
}

export function queueReplacedImageUrl(
  imageUrls: string[],
  imageUrl: unknown,
): string[] {
  if (typeof imageUrl !== "string") {
    return imageUrls;
  }
  const normalizedImageUrl = imageUrl.trim();
  if (!normalizedImageUrl || imageUrls.includes(normalizedImageUrl)) {
    return imageUrls;
  }
  return [...imageUrls, normalizedImageUrl];
}
