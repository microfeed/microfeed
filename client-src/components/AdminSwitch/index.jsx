import React from "react";
import clsx from "clsx";
import { Switch } from '@headlessui/react'

export default function AdminSwitch(
  { label, enabled, setEnabled, customClass = '' }) {
  return (<label className="">
    {label && <div className="lh-page-subtitle">{label}</div>}
    <div className="w-full">
      <Switch
        checked={enabled}
        onChange={setEnabled}
        className={clsx('relative inline-flex h-6 w-11 items-center rounded-full',
          enabled ? 'bg-brand-light' : 'bg-gray-200', customClass)}
      >
        {label && <span className="sr-only">{label}</span>}
        <span
          className={`${
            enabled ? 'translate-x-6' : 'translate-x-1'
          } inline-block h-4 w-4 transform rounded-full bg-white transition`}
        />
      </Switch>
    </div>
  </label>);
}
