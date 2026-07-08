import React from "react";
import clsx from "clsx";
import {Dialog, DialogPanel, DialogTitle} from '@headlessui/react'

export default function AdminDialog({title, isOpen, setIsOpen, children, disabledClose=false, widthClass='w-full sm:max-w-lg lg:max-w-xl'}) {
  return (<Dialog
    className="relative z-50"
    open={isOpen}
    onClose={() => {/*Empty function disables ESC to dismiss & click outside to dismiss*/}}
  >
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className={clsx(widthClass, "max-h-full overflow-y-auto rounded-lg border border-gray-200 shadow-xl bg-white p-4")}>
        <div className="flex items-center justify-end border-b border-gray-200 mb-3 pb-3">
          <DialogTitle as="div" className="flex-1 font-semibold text-gray-900">{title}</DialogTitle>
          <div className="flex-none">
            <button
              onClick={() => setIsOpen(false)}
              disabled={disabledClose}
              className={clsx(
                'text-sm rounded-md px-2 py-1 transition-colors',
                'text-helper-color hover:bg-gray-100 hover:opacity-100 hover:text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-brand-light/30',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
              )}
            >
              <span className="lh-icon-x-mark text-lg"/> Close
            </button>
          </div>
        </div>
        {children}
      </DialogPanel>
    </div>
  </Dialog>);
}
