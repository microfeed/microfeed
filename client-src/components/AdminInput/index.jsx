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
        className={clsx(
          'w-full rounded-md border border-gray-300 shadow-sm transition-colors',
          'placeholder:text-gray-400 text-gray-900',
          'hover:border-gray-400',
          'focus:border-brand-light focus:ring-2 focus:ring-brand-light/30 focus:outline-none',
          customClass || 'text-sm px-3 py-2',
          disabled && 'bg-gray-100 text-gray-400 cursor-not-allowed hover:border-gray-300'
        )}
        disabled={disabled}
        {...extraParams}
      />
    </div>
  </label>);
}
