import React from "react";
import {Dialog} from '@headlessui/react'

export default function AdminDialog({isOpen, setIsOpen, children, disabledClose=false}) {
  return (<Dialog
    className="relative z-50"
    open={isOpen}
    onClose={() => {/*Empty function disables ESC to dismiss & click outside to dismiss*/}}
  >
    <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <Dialog.Panel className="w-full sm:max-w-lg lg:max-w-xl max-h-full rounded bg-white p-4">
        <div className="flex justify-end border-b mb-2 pb-2">
          <button
            onClick={() => setIsOpen(false)}
            disabled={disabledClose}
            className="text-sm hover:opacity-50"
          >
            <span className="lh-icon-x-mark text-lg" /> Close
          </button>
        </div>
        {children}
      </Dialog.Panel>
    </div>
  </Dialog>);
}
