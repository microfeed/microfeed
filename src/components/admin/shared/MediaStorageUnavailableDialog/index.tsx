import {CloudUpload} from "lucide-react";

import {Button, buttonVariants} from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {cn} from "@/lib/utils";

type MediaStorageState = "disabled" | "pending" | "ready";

interface MediaStorageUnavailableDialogProps {
  dashboardUrl?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  state?: MediaStorageState;
}

export function MediaStorageSetupInstructions({
  dashboardUrl,
  state,
}: {
  dashboardUrl?: string;
  state?: MediaStorageState;
}) {
  const local = !dashboardUrl;
  const command = local
    ? "yarn manage deploy --local --enable-r2"
    : "yarn manage deploy --enable-r2";

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="font-medium">Enable file uploads</div>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {dashboardUrl && (
          <li>
            {state === "pending"
              ? "Activate R2 in Cloudflare and complete billing setup if Cloudflare requests it."
              : "Make sure R2 is active for the Cloudflare account."}
          </li>
        )}
        <li>
          From the microfeed repository checkout, run{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs text-foreground ring-1 ring-foreground/10">
            {command}
          </code>
          .
        </li>
        <li>Reload this page after deployment finishes.</li>
      </ol>
    </div>
  );
}

export default function MediaStorageUnavailableDialog({
  dashboardUrl,
  onOpenChange,
  open,
  state,
}: MediaStorageUnavailableDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CloudUpload aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle>File uploads require R2</DialogTitle>
          <DialogDescription>
            This microfeed is running without R2 media storage, so direct file
            uploads are disabled. You can keep publishing with external URLs.
          </DialogDescription>
        </DialogHeader>
        <MediaStorageSetupInstructions
          dashboardUrl={dashboardUrl}
          state={state}
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Close
          </DialogClose>
          {dashboardUrl && (
            <a
              className={cn(buttonVariants(), "cursor-pointer")}
              href={dashboardUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open Cloudflare R2
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
