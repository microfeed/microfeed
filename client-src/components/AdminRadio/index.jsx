import React from "react";
import clsx from "clsx";

export default function AdminRadio(
  { label, groupName, buttons, onChange, labelComponent = null,
    disabled = false, customLabelClass = '', }) {
  return (<fieldset className="flex flex-col justify-start">
    {label && <legend className={clsx( customLabelClass || 'lh-page-subtitle')}>{label}</legend>}
    {labelComponent}
    <div className="w-full flex flex-wrap gap-4">
      {buttons.map((b) => (
        <label key={`${groupName}-${b.name}`} className={clsx('flex items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
          <input
            type="radio"
            name={groupName} value={b.value || b.name} checked={b.checked}
            onChange={(e) => {
              onChange(e);
            }}
            className="text-brand-light border-gray-300 focus:ring-2 focus:ring-brand-light/30 focus:outline-none"
            disabled={disabled}
          />
          <div className={clsx('ml-1.5 text-sm', b.checked ? 'text-gray-900 font-medium' : 'text-helper-color')}>{b.name}</div>
        </label>
      ))}
    </div>
  </fieldset>);
}
