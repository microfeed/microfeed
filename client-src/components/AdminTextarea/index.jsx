import React from "react";

export default function AdminTextarea({ label, value, onChange, placeholder='' }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <textarea
        className="w-full"
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  </label>);
}
