import {BookOpenIcon, ExternalLinkIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const THEME_GUIDE_URL = "https://docs.microfeed.org/dashboard/themes/";
const THEME_COMMAND_REFERENCE_URL =
  "https://docs.microfeed.org/manage-cli/#yarn-manage-theme";

interface Props {
  instanceName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function Command({children}: {children: string}) {
  return (
    <code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
      {children}
    </code>
  );
}

export default function ThemeInstallHelpDialog({
  instanceName,
  onOpenChange,
  open,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>How to install or change a theme</DialogTitle>
          <DialogDescription>
            Install trusted theme packages with the management CLI, or derive a
            new immutable version from one that is already installed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 text-sm leading-relaxed">
          <section className="grid gap-3">
            <div>
              <h3 className="font-semibold">Install a community theme</h3>
              <p className="mt-1 text-muted-foreground">
                From your microfeed checkout, install a public GitHub repository.
                The new version is inactive, so you can preview it before it
                changes the public site.
              </p>
            </div>
            <Command>
              {`yarn manage theme install https://github.com/owner/theme-repository --instance ${instanceName}`}
            </Command>
          </section>

          <section className="grid gap-3">
            <div>
              <h3 className="font-semibold">Install the bundled default</h3>
              <p className="mt-1 text-muted-foreground">
                This installs the default theme from your current microfeed
                checkout as another inactive version.
              </p>
            </div>
            <Command>
              {`yarn manage theme install default --instance ${instanceName}`}
            </Command>
          </section>

          <section>
            <h3 className="font-semibold">Create a new version in Admin</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Choose <strong className="text-foreground">Create new version</strong> on an installed theme.</li>
              <li>Edit, save, and preview the separate version draft.</li>
              <li>Choose <strong className="text-foreground">Install</strong> to create an immutable inactive version.</li>
              <li>Preview the installed version, then activate it separately.</li>
            </ol>
            <p className="mt-2 text-muted-foreground">
              The source version and the currently active version are never
              modified in place.
            </p>
          </section>

          <section className="grid gap-3">
            <div>
              <h3 className="font-semibold">Start your own theme repository</h3>
              <p className="mt-1 text-muted-foreground">
                Initialize a standalone repository from this instance&apos;s
                effective active theme. Missing parent directories are created
                automatically.
              </p>
            </div>
            <Command>
              {`yarn manage theme init ~/microfeed-themes/my-theme --instance ${instanceName}`}
            </Command>
          </section>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              render={<a href={THEME_GUIDE_URL} rel="noopener noreferrer" target="_blank" />}
              variant="outline"
            >
              <BookOpenIcon aria-hidden="true" />
              Theme guide
            </Button>
            <Button
              render={<a href={THEME_COMMAND_REFERENCE_URL} rel="noopener noreferrer" target="_blank" />}
              variant="outline"
            >
              <ExternalLinkIcon aria-hidden="true" />
              Command reference
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
