import React from "react";
import {Dialog} from '@headlessui/react'

export default function LhDialog({title, isOpen, setIsOpen, children}) {
  return (<Dialog
    className="relative z-50"
    open={isOpen}
    onClose={() => {/*Empty function disables ESC to dismiss & click outside to dismiss*/}}
  >
    <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <Dialog.Panel className="w-full sm:max-w-lg lg:max-w-xl max-h-full rounded bg-white p-4">
        <div className="flex justify-end">
          <button onClick={() => setIsOpen(false)} className="text-sm">Close</button>
        </div>
        {title && <Dialog.Title>{title}</Dialog.Title>}
        <Dialog.Description>
          {children}
        </Dialog.Description>
      </Dialog.Panel>
    </div>
  </Dialog>);
}
