import {useId, type ReactNode} from "react";

import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {cn} from "@/lib/utils";

interface AdminSwitchProps {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  label?: ReactNode;
  labelClassName?: string;
  onCheckedChange: (checked: boolean) => void;
}

export default function AdminSwitch({
  checked,
  className,
  disabled = false,
  label,
  labelClassName,
  onCheckedChange,
}: AdminSwitchProps) {
  const id = useId();

  return (
    <div className="flex items-center gap-1.5">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={className}
      />
      {label && (
        <Label
          htmlFor={id}
          className={cn(
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            labelClassName,
          )}
        >
          {label}
        </Label>
      )}
    </div>
  );
}
