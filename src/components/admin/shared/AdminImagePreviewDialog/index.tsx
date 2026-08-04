import {
  ExternalLinkIcon,
  XIcon,
} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminImagePreviewDialogProps {
  alt?: string;
  imageUrl: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function AdminImagePreviewDialog({
  alt = "Uploaded image",
  imageUrl,
  onOpenChange,
  open,
}: AdminImagePreviewDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="inset-0 top-0 left-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-black/80 p-6 text-white ring-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">
          Full-screen preview of the uploaded image.
        </DialogDescription>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <a
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-white/30 bg-black/30 px-4 text-sm font-medium !text-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 hover:!text-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/30 [&_svg]:size-4 [&_svg]:text-white"
            href={imageUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon aria-hidden="true" />
            Open
          </a>
          <DialogClose
            render={(
              <Button
                className="border-white/30 bg-black/30 !text-white transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 hover:!text-white hover:shadow-lg [&_svg]:text-white"
                type="button"
                variant="outline"
              />
            )}
          >
            <XIcon aria-hidden="true" />
            Close
          </DialogClose>
        </div>
        <img
          alt={alt}
          className="max-h-[calc(100dvh-3rem)] max-w-[calc(100dvw-3rem)] object-contain"
          src={imageUrl}
        />
      </DialogContent>
    </Dialog>
  );
}
