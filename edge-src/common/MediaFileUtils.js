export function isValidMediaFile(mediaFile) {
  return mediaFile && mediaFile.category && mediaFile.url && mediaFile.url.trim();
}
