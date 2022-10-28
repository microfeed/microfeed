import React from "react";

export default function AdminInput({ label, value, onChange }) {
  return (<label>
    {label}
    <div>
      <input
        type="text"
        value={value || ''}
        onChange={onChange}
      />
    </div>
  </label>);
}
