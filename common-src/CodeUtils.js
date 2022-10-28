export function randomHex(size=32) {
  return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}
