import React from "react";
import clsx from "clsx";

export default function AdminInput(
  { label, value, onChange, labelComponent = null, placeholder = '', disabled = false,
    setRef = () => {}, customLabelClass = '', customClass = '', type = 'text',
    extraParams = {} }) {
  return (<label className="w-full">
    {label && <div className={clsx(customLabelClass || "lh-page-subtitle")}>{label}</div>}
    {labelComponent}
    <div className="w-full">
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        ref={(ref) => setRef(ref)}
        className={clsx('w-full rounded-sm', customClass || 'text-sm', disabled && 'bg-gray-100')}
        disabled={disabled}
        {...extraParams}
      />
    </div>
  </label>);
}
