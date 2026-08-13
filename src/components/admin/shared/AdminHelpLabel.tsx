import {useState, type ReactNode} from "react";
import {CircleArrowRightIcon} from "lucide-react";

import {cn} from "@/lib/utils";
import {ADMIN_URLS, PUBLIC_URLS} from "@/shared/StringUtils";

import AdminDialog from "./AdminDialog";
import ExternalLink from "./ExternalLink";

export interface AdminHelpContent {
  json?: string | null;
  linkName: string;
  modalTitle?: string;
  rss?: string | null;
  text: string;
}

interface AdminHelpLabelBaseProps {
  className?: string;
  id?: string;
  required?: boolean;
}

type AdminHelpLabelProps = AdminHelpLabelBaseProps & (
  | {
    children?: ReactNode;
    help: AdminHelpContent;
    onClick?: never;
  }
  | {
    children: ReactNode;
    help?: never;
    onClick: () => void;
  }
);

export default function AdminHelpLabel({
  children,
  className,
  help,
  id,
  onClick,
  required = false,
}: AdminHelpLabelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const label = children ?? help?.linkName;

  return (
    <>
      <button
        className={cn(
          "mb-1 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-brand-light focus-visible:text-brand-light",
          className,
        )}
        id={id}
        onClick={help ? () => setIsOpen(true) : onClick}
        type="button"
      >
        <span>
          {label}
          {required && (
            <span aria-hidden="true" className="text-destructive"> *</span>
          )}
        </span>
        <CircleArrowRightIcon aria-hidden="true" className="size-4" />
      </button>
      {help && (
        <AdminDialog
          onOpenChange={setIsOpen}
          open={isOpen}
          title={help.modalTitle || help.linkName}
        >
          <div className="py-2">
            <div className="text-helper-color grid grid-cols-1 gap-4 text-sm">
              <div
                className="leading-relaxed"
                dangerouslySetInnerHTML={{__html: help.text}}
              />
              {help.rss ? (
                <div>
                  <div>
                    <ExternalLink text="in rss" url={PUBLIC_URLS.rssFeed()} />
                  </div>
                  <code className="m-code">{help.rss}</code>
                  <div className="text-muted-color mt-2 text-xs">
                    Learn more about Podcasts RSS at{" "}
                    <a
                      className="text-helper-color"
                      href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      apple.com
                    </a>.
                  </div>
                </div>
              ) : (
                <em>{help.linkName} is not in rss feed</em>
              )}
              {help.json ? (
                <div>
                  <div>
                    <ExternalLink text="in json" url={PUBLIC_URLS.jsonFeed()} />
                  </div>
                  <code className="m-code">{help.json}</code>
                  <div className="text-muted-color mt-2 text-xs">
                    Learn more about JSON Feed at{" "}
                    <a
                      className="text-helper-color"
                      href="https://www.jsonfeed.org/"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      jsonfeed.org
                    </a>. See the generated schema and examples in{" "}
                    <a
                      className="text-helper-color"
                      href={ADMIN_URLS.apiExplorer()}
                    >
                      API Explorer
                    </a>.
                  </div>
                </div>
              ) : (
                <em>{help.linkName} is not in json feed</em>
              )}
            </div>
          </div>
        </AdminDialog>
      )}
    </>
  );
}
