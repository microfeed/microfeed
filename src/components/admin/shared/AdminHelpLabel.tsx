import type {ReactNode} from "react";
import {CircleArrowRightIcon} from "lucide-react";

import {cn} from "@/lib/utils";

export default function AdminHelpLabel({
  children,
  className,
  id,
  onClick,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  onClick: () => void;
  required?: boolean;
}) {
  return (
    <button
      className={cn(
        "mb-1 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-foreground hover:text-primary",
        className,
      )}
      id={id}
      onClick={onClick}
      type="button"
    >
      <span>
        {children}
        {required && (
          <span aria-hidden="true" className="text-destructive"> *</span>
        )}
      </span>
      <CircleArrowRightIcon aria-hidden="true" className="size-4" />
    </button>
  );
}
