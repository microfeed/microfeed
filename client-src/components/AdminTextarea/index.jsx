import React from "react";

export default function AdminTextarea({ label, value, onChange }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <textarea
        className="w-full"
        value={value || ''}
        onChange={onChange}
      />
    </div>
  </label>);
}
