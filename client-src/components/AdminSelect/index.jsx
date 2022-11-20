import React from "react";
import Select from 'react-select';

export default function AdminSelect({ label, value, options, onChange, extraParams }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <Select
        styles={{
          control: (baseStyles, state) => ({
            ...baseStyles,
            borderColor: state.isFocused ? 'grey' : 'black',
            borderRadius: 0,
          }),
        }}
        className="text-sm"
        value={value}
        options={options}
        onChange={onChange}
        {...extraParams}
      />
    </div>
  </label>);
}
