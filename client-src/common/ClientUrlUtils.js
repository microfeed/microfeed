export function getPublicBaseUrl() {
  const {location} = window;
  let baseUrl = `${location.protocol}//${location.hostname}`;
  console.log(location.protocol);
  if (!(location.port === '80' && location.protocol === 'http:') &&
      !(location.port === '443' && location.protocol === 'https:')) {
    baseUrl = `${baseUrl}:${location.port}`;
  }
  return baseUrl;
}
