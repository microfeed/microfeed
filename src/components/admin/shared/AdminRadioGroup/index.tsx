import {useId, type ReactNode} from "react";

import {Label} from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {cn} from "@/lib/utils";

export interface AdminRadioOption {
  description?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  onDisabledClick?: () => void;
  value: string;
}

interface AdminRadioGroupProps {
  alignment?: "center" | "start";
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  label?: ReactNode;
  labelClassName?: string;
  labelComponent?: ReactNode;
  name: string;
  onValueChange: (value: string) => void;
  options: AdminRadioOption[];
  value: string;
  variant?: "cards" | "inline";
}

export default function AdminRadioGroup({
  alignment = "center",
  ariaLabel,
  className,
  disabled = false,
  label,
  labelClassName,
  labelComponent,
  name,
  onValueChange,
  options,
  value,
  variant = "inline",
}: AdminRadioGroupProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const hasVisibleLabel = Boolean(label || labelComponent);

  return (
    <fieldset className="flex min-w-0 flex-col justify-start">
      {hasVisibleLabel && (
        <div id={labelId}>
          {label && (
            <div className={cn(labelClassName || "mb-2 text-sm font-semibold text-foreground")}>
              {label}
            </div>
          )}
          {labelComponent}
        </div>
      )}
      <RadioGroup
        aria-label={hasVisibleLabel ? undefined : (ariaLabel ?? name)}
        aria-labelledby={hasVisibleLabel ? labelId : undefined}
        className={cn(
          variant === "cards"
            ? "grid grid-cols-1 gap-4"
            : "flex w-full flex-wrap gap-4",
          className,
        )}
        disabled={disabled}
        name={name}
        value={value}
        onValueChange={(nextValue, eventDetails) => {
          const nextOption = options.find((option) => option.value === nextValue);
          if (nextOption?.disabled) {
            eventDetails.cancel();
            nextOption.onDisabledClick?.();
            return;
          }
          onValueChange(nextValue);
        }}
      >
        {options.map((option) => {
          const optionId = `${generatedId}-${option.value}`;
          const guidedDisabled = Boolean(
            !disabled && option.disabled && option.onDisabledClick,
          );
          const optionDisabled = Boolean(disabled || option.disabled);
          const radio = (
            <RadioGroupItem
              id={optionId}
              value={option.value}
              aria-disabled={optionDisabled || undefined}
              disabled={optionDisabled && !guidedDisabled}
              className={cn(
                alignment === "start" && "mt-1",
                guidedDisabled && "cursor-not-allowed opacity-60",
              )}
            />
          );

          if (variant === "cards") {
            return (
              <Label
                key={option.value}
                htmlFor={optionId}
                data-disabled={optionDisabled || undefined}
                className={cn(
                  "gap-4 rounded-[14px] border bg-card p-4 has-[[data-slot=radio-group-item][data-checked]]:border-brand-light has-[[data-slot=radio-group-item][data-checked]]:ring-1 has-[[data-slot=radio-group-item][data-checked]]:ring-brand-light/20",
                  alignment === "start" ? "items-start" : "items-center",
                  optionDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer",
                )}
              >
                {radio}
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </Label>
            );
          }

          return (
            <Label
              key={option.value}
              htmlFor={optionId}
              data-disabled={optionDisabled || undefined}
              className={cn(
                "gap-1.5",
                alignment === "start" ? "items-start" : "items-center",
                optionDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer",
                option.value === value ? "" : "text-muted-foreground",
              )}
            >
              {radio}
              <span>{option.label}</span>
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
