import React from "react";
import {msToDatetimeLocalString, datetimeLocalToString} from '../../../common-src/TimeUtils';

export default function AdminDatetimePicker({ label, value, onChange }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <input
        type="datetime-local"
        value={value ? msToDatetimeLocalString(value) : datetimeLocalToString(new Date())}
        className="w-full text-sm rounded"
        onChange={onChange}
      />
    </div>
  </label>
);
}
