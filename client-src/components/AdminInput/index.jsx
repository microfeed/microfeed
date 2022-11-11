import React from "react";
import clsx from "clsx";

export default function AdminInput(
  { label, value, onChange, placeholder = '', disabled = false, customClass = '' }) {
  return (<label className="w-full">
    {label && <div className="lh-page-subtitle">{label}</div>}
    <div className="w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        className={clsx('w-full', customClass, disabled && 'bg-gray-100')}
        disabled={disabled}
      />
    </div>
  </label>);
}
