import React from "react";

export default function AdminInput({ label, value, onChange }) {
  return (<label className="lh-page-subtitle">
    {label}
    <div className="w-full mt-2">
      <input
        type="text"
        value={value || ''}
        onChange={onChange}
        className="w-full"
      />
    </div>
  </label>);
}
