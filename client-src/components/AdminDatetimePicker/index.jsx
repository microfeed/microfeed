import React from "react";
import {msToDatetimeLocalString, datetimeLocalToString} from '../../../common-src/TimeUtils';

export default function AdminDatetimePicker({ label, value, onChange }) {
  console.log(value);
  console.log((new Date()).toISOString());
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <input
        type="datetime-local"
        value={value ? msToDatetimeLocalString(value) : datetimeLocalToString(new Date())}
        className="w-full"
        onChange={onChange}
      />
    </div>
  </label>
);
}
