import React from "react";
import Select from 'react-select';

export default function AdminSelect(
  { label, value, options, onChange, extraParams, labelComponent = null }) {
  return (<label className="w-full">
    {label&& <div className="lh-page-subtitle">{label}</div>}
    {labelComponent}
    <div className="w-full">
      <Select
        styles={{
          control: (baseStyles, state) => ({
            ...baseStyles,
            borderColor: state.isFocused ? '#19b7fa' : '#d1d5db',
            borderRadius: 6,
            boxShadow: state.isFocused ? '0 0 0 2px rgba(25, 183, 250, 0.3)' : baseStyles.boxShadow,
            '&:hover': {
              borderColor: state.isFocused ? '#19b7fa' : '#9ca3af',
            },
          }),
        }}
        className="text-sm"
        classNamePrefix="lh-select"
        value={value}
        options={options}
        onChange={onChange}
        {...extraParams}
      />
    </div>
  </label>);
}
