import {useState} from "react";
import {CheckIcon, CopyIcon, ExternalLinkIcon} from "lucide-react";

import {Button, buttonVariants} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {cn} from "@/lib/utils";

interface Props {
  label: string;
  url: string;
}

export default function AdminCopyableUrl({label, url}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div aria-label={`${label} address controls`} className="flex min-w-0" role="group">
      <Input
        aria-label={`${label} address`}
        className="rounded-r-none font-mono text-xs disabled:text-foreground disabled:opacity-100"
        disabled
        value={url}
      />
      <Button
        aria-label={copied ? `Copied ${label} address` : `Copy ${label} address`}
        className="-ml-px rounded-none"
        onClick={() => void copyUrl()}
        size="icon"
        title={`Copy ${label} address`}
        type="button"
        variant="outline"
      >
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      </Button>
      <a
        aria-label={`Open ${label} in a new tab`}
        className={cn(
          buttonVariants({size: "icon", variant: "outline"}),
          "-ml-px rounded-l-none",
        )}
        href={url}
        rel="noopener noreferrer"
        target="_blank"
        title={`Open ${label} in a new tab`}
      >
        <ExternalLinkIcon aria-hidden="true" />
      </a>
    </div>
  );
}
