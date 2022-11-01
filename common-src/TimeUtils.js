export function datetimeLocalStringToMs(str) {
  return Date.parse(str);
}

export function msToDatetimeLocalString(ms) {
  const dt = new Date(ms);
  return datetimeLocalToString(dt);
}

export function datetimeLocalToMs(dt) {
  return dt.getTime();
}

export function datetimeLocalToString(dt) {
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}
