import React from "react";
import clsx from "clsx";
import TextareaAutosize from 'react-textarea-autosize';

export default function AdminTextarea({ label, value, onChange, minRows = 3, maxRows = 10,
                                        customCss = '', placeholder='' }) {
  return (<label className="">
    <div className="lh-page-subtitle">{label}</div>
    <div className="w-full">
      <TextareaAutosize
        className={clsx(
          'w-full rounded-md border border-gray-300 shadow-sm transition-colors text-sm px-3 py-2',
          'placeholder:text-gray-400 text-gray-900',
          'hover:border-gray-400',
          'focus:border-brand-light focus:ring-2 focus:ring-brand-light/30 focus:outline-none',
          customCss
        )}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        minRows={minRows}
        maxRows={maxRows}
      />
    </div>
  </label>);
}
