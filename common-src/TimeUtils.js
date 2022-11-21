export function humanizeMs(ms) {
  const date = new Date(ms);
  return date.toDateString();
}

export function toHHMMSS(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds); // specify value for SECONDS here
  return date.toISOString().substring(11, 19);
}

export function datetimeLocalStringToMs(str) {
  return Date.parse(str);
}

/**
 * e.g., 2022-11-14T20:05
 */
export function msToDatetimeLocalString(ms) {
  const dt = new Date(ms);
  return datetimeLocalToString(dt);
}

/**
 * Tue, 15 Nov 2022 04:05:56 GMT
 */
export function msToUtcString(ms) {
  const dt = new Date(ms);
  return dt.toUTCString();
}

export function msToRFC3339(ms) {
  const dt = new Date(ms);
  return dt.toISOString();
}

export function datetimeLocalToMs(dt) {
  return dt.getTime();
}

export function datetimeLocalToString(dt) {
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}
