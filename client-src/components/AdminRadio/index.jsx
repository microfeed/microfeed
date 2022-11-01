import React from "react";

export default function AdminRadio({ label, groupName, buttons, onChange}) {
  return (<fieldset className="flex flex-col justify-center">
    <legend className="lh-page-subtitle">{label}</legend>
    <div className="w-full flex">
      {buttons.map((b) => (
        <label key={`${groupName}-${b.name}`} className="mr-4">
          <input type="radio" name={groupName} value={b.name} checked={b.checked} onChange={onChange}/>
          <span className="ml-1">{b.name}</span>
        </label>
      ))}
    </div>
  </fieldset>);
}
