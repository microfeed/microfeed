import React from "react";
import clsx from "clsx";
import TextareaAutosize from 'react-textarea-autosize';

export default function AdminTextarea({ label, value, onChange, minRows = 3, maxRows = 10,
                                        customCss = '', placeholder='' }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <TextareaAutosize
        className={clsx('w-full', customCss)}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        minRows={minRows}
        maxRows={maxRows}
      />
    </div>
  </label>);
}
