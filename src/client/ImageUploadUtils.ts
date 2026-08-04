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
