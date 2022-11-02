import React from "react";

export default function AdminInput({ label, value, onChange, placeholder = '' }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        className="w-full"
      />
    </div>
  </label>);
}
