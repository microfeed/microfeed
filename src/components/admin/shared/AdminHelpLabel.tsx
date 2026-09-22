import {useRef, useState, type ReactNode} from "react";
import {CircleArrowRightIcon} from "lucide-react";

import {cn} from "@/lib/utils";
import {ADMIN_URLS, PUBLIC_URLS} from "@/shared/StringUtils";

import AdminDialog from "./AdminDialog";
import ExternalLink from "./ExternalLink";

export interface AdminHelpContent {
  html?: string;
  htmlNote?: string;
  json?: string | null;
  jsonNote?: string;
  linkName: string;
  modalTitle?: string;
  rss?: string | null;
  rssReference?: {label: string; url: string};
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
  const trigger = useRef<HTMLButtonElement>(null);
  const label = children ?? help?.linkName;

  return (
    <>
      <button
        className={cn(
          "mb-1 flex w-fit cursor-pointer items-center gap-2 rounded-sm text-sm font-medium text-foreground transition-colors hover:text-brand-light focus-visible:text-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        id={id}
        ref={trigger}
        aria-haspopup={help ? "dialog" : undefined}
        aria-expanded={help ? isOpen : undefined}
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
          finalFocus={trigger}
          onOpenChange={setIsOpen}
          open={isOpen}
          title={help.modalTitle || help.linkName}
        >
          <div className="py-2">
            <div className="text-helper-color grid min-w-0 grid-cols-1 gap-4 text-sm">
              <div
                className="leading-relaxed"
                dangerouslySetInnerHTML={{__html: help.text}}
              />
              {help.html && (
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground">In HTML</h3>
                  <code className="m-code whitespace-pre-wrap">{help.html}</code>
                  {help.htmlNote && <p className="mt-2 text-xs text-muted-foreground">{help.htmlNote}</p>}
                </div>
              )}
              {help.rss ? (
                <div>
                  <div>
                    <ExternalLink text="in rss" url={PUBLIC_URLS.rssFeed()} />
                  </div>
                  <code className="m-code whitespace-pre-wrap">{help.rss}</code>
                  <div className="text-muted-color mt-2 text-xs">
                    {help.rssReference ? <a href={help.rssReference.url} rel="noopener noreferrer" target="_blank"
                      className="text-helper-color">{help.rssReference.label}</a> : <>
                    Learn more about Podcasts RSS at{" "}
                    <a
                      className="text-helper-color"
                      href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      apple.com
                    </a>.</>}
                  </div>
                </div>
              ) : !help.html && (
                <em>{help.linkName} is not in rss feed</em>
              )}
              {help.json ? (
                <div>
                  <div>
                    <ExternalLink text="in json" url={PUBLIC_URLS.jsonFeed()} />
                  </div>
                  <code className="m-code whitespace-pre-wrap">{help.json}</code>
                  {help.jsonNote && <p className="mt-2 text-xs text-muted-foreground">{help.jsonNote}</p>}
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
