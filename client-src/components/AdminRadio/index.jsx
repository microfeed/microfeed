import React from "react";
import clsx from "clsx";

export default function AdminRadio(
  { label, groupName, buttons, onChange, disabled = false, customLabelClass = ''}) {
  return (<fieldset className="flex flex-col justify-center">
    {label && <legend className="lh-page-subtitle">{label}</legend>}
    <div className="w-full flex">
      {buttons.map((b) => (
        <label key={`${groupName}-${b.name}`} className="mr-4 flex items-center">
          <input
            type="radio"
            name={groupName} value={b.value || b.name} checked={b.checked}
            onChange={onChange}
            className="text-brand-light"
            disabled={disabled}
          />
          <div className={clsx('ml-1', customLabelClass)}>{b.name}</div>
        </label>
      ))}
    </div>
  </fieldset>);
}