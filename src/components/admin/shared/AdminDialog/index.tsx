import type {ComponentProps, ReactNode} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminDialogProps {
  children: ReactNode;
  closeDisabled?: boolean;
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
}

export default function AdminDialog({
  children,
  closeDisabled = false,
  finalFocus,
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
        finalFocus={finalFocus}
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg lg:max-w-xl"
        showCloseButton={!closeDisabled}
      >
        <DialogHeader className="border-b pb-2 pr-8">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
