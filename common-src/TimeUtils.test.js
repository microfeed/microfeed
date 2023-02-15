import {datetimeLocalStringToMs, msToDatetimeLocalString, humanizeMs} from "./TimeUtils";

test('datetimeStringToMs', () => {
  const dtStr = '2022-10-31T18:49';
  const dtMs = 1667242140000;
  expect(datetimeLocalStringToMs(dtStr)).toBe(dtMs);
  expect(msToDatetimeLocalString(dtMs)).toBe(dtStr);
});

test('humanizeMs', () => {
  const ms = 1676508181000;
  // XXX: we don't know the timezone of the CI server.
  // const noTimezoneStr = 'Wed Feb 15 2023';
  expect(humanizeMs(ms).indexOf('2023') !== -1).toBe(true);

  const timezone = 'Europe/Paris';
  const timezoneStr = 'Thu Feb 16 2023';
  expect(humanizeMs(ms, timezone)).toBe(timezoneStr);
});
