import React from "react";
import {msToDatetimeLocalString, datetimeLocalToString} from '../../../common-src/TimeUtils';

export default function AdminDatetimePicker({ label, value, onChange, labelComponent = null }) {
  return (<label className="">
    {label && <div className="lh-page-subtitle">{label}</div>}
    {labelComponent}
    <div className="w-full">
      <input
        type="datetime-local"
        value={value ? msToDatetimeLocalString(value) : datetimeLocalToString(new Date())}
        className="w-full text-sm rounded-sm"
        onChange={onChange}
      />
    </div>
  </label>
);
}
