"use client";
import {Checkbox as CheckboxPrimitive} from "@base-ui/react/checkbox";
import {CheckIcon} from "lucide-react";
import {cn} from "@/lib/utils";

export function Checkbox({className, ...props}: CheckboxPrimitive.Root.Props) {
  return <CheckboxPrimitive.Root data-slot="checkbox" className={cn(
    "inline-flex size-4 shrink-0 items-center justify-center rounded border border-input outline-none focus-visible:ring-2 focus-visible:ring-brand-light data-checked:bg-brand-light data-checked:text-white data-disabled:cursor-not-allowed data-disabled:opacity-50", className,
  )} {...props}><CheckboxPrimitive.Indicator><CheckIcon className="size-3" /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
