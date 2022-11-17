import React from "react";

export default function AdminSelect({ label, value, onChange }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <input
        type="text"
        value={value || ''}
        onChange={onChange}
        className="w-full"
      />
    </div>
  </label>);
}
