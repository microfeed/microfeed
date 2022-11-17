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

export function datetimeLocalToMs(dt) {
  return dt.getTime();
}

export function datetimeLocalToString(dt) {
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}
