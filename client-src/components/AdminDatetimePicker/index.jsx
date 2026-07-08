import React from "react";
import {msToDatetimeLocalString, datetimeLocalToString} from '../../../common-src/TimeUtils';

export default function AdminDatetimePicker({ label, value, onChange, labelComponent = null }) {
  return (<label className="w-full">
    {label && <div className="lh-page-subtitle">{label}</div>}
    {labelComponent}
    <div className="w-full">
      <input
        type="datetime-local"
        value={value ? msToDatetimeLocalString(value) : datetimeLocalToString(new Date())}
        className={
          "w-full text-sm rounded-md border border-gray-300 shadow-sm px-3 py-2 text-gray-900 " +
          "transition-colors hover:border-gray-400 " +
          "focus:border-brand-light focus:ring-2 focus:ring-brand-light/30 focus:outline-none"
        }
        onChange={onChange}
      />
    </div>
  </label>
);
}
