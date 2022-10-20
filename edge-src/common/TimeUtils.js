export function humanizeMs(ms) {
  const date = new Date(ms);
  return date.toDateString();
}

export function toHHMMSS(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds); // specify value for SECONDS here
  return date.toISOString().substring(11, 19);
}
