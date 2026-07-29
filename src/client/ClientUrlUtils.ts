export function getPublicBaseUrl() {
  const {location} = window;
  let baseUrl = `${location.protocol}//${location.hostname}`;
  if (location.port !== '') {
    baseUrl = `${baseUrl}:${location.port}`;
  }
  return baseUrl;
}
