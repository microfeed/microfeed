import type {ReactNode} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminDialogProps {
  children: ReactNode;
  closeDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
}

export default function AdminDialog({
  children,
  closeDisabled = false,
  onOpenChange,
  open,
  title,
}: AdminDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && closeDisabled) {
          eventDetails.cancel();
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg lg:max-w-xl"
        showCloseButton={!closeDisabled}
      >
        <DialogHeader className="border-b pb-2 pr-8">
          <DialogTitle className="text-helper-color">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
