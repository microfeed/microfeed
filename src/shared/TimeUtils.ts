export function humanizeMs(ms: any, timezone: any = null) {
  const date = new Date(ms);
  let newDate;
  try {
    newDate = new Date(date.toLocaleDateString('en-US', {timeZone: timezone}));
  } catch (e) {
    newDate = date;
  }
  return newDate.toDateString();
}

export function toHHMMSS(seconds: any) {
  const date = new Date(0);
  date.setSeconds(seconds); // specify value for SECONDS here
  return date.toISOString().substring(11, 19);
}

export function datetimeLocalStringToMs(str: any) {
  return Date.parse(str);
}

/**
 * e.g., 2022-11-14T20:05
 */
export function msToDatetimeLocalString(ms: any) {
  const dt = new Date(ms);
  return datetimeLocalToString(dt);
}

/**
 * Tue, 15 Nov 2022 04:05:56 GMT
 */
export function msToUtcString(ms: any) {
  const dt = new Date(ms);
  return dt.toUTCString();
}

export function msToRFC3339(ms: any) {
  const dt = new Date(ms);
  return dt.toISOString();
}

export function rfc3399ToMs(str: any) {
  const dt = new Date(str);
  return dt.getTime();
}

export function datetimeLocalToMs(dt: any) {
  return dt.getTime();
}

export function datetimeLocalToString(dt: any) {
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}
