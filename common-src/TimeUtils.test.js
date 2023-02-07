import {datetimeLocalStringToMs, msToDatetimeLocalString} from "./TimeUtils";

test('datetimeStringToMs', () => {
  const dtStr = '2022-10-31T18:49';
  const dtMs = 1667242140000;
  expect(datetimeLocalStringToMs(dtStr)).toBe(dtMs);
  expect(msToDatetimeLocalString(dtMs)).toBe(dtStr);
});
