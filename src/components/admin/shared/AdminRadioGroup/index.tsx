import {useId, type MouseEvent, type ReactNode} from "react";
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
          const optionLabelId = `${optionId}-label`;
          const optionDescriptionId = `${optionId}-description`;
          const guidedDisabled = Boolean(
            !disabled && option.disabled && option.onDisabledClick,
          );
          const optionDisabled = Boolean(disabled || option.disabled);
          const selectFromOption = (event: MouseEvent<HTMLDivElement>) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest("button, a, input, select, textarea")
            ) {
              return;
            }

            event.currentTarget
              .querySelector<HTMLButtonElement>(
                '[data-slot="radio-group-item"]',
              )
              ?.click();
          };
          const radio = (
            <RadioGroupItem
              id={optionId}
              value={option.value}
              aria-labelledby={optionLabelId}
              aria-describedby={
                option.description ? optionDescriptionId : undefined
              }
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
              <div
                key={option.value}
                data-slot="radio-option"
                data-disabled={optionDisabled || undefined}
                onClick={selectFromOption}
                className={cn(
                  "flex gap-4 rounded-[14px] border bg-card p-4 text-sm leading-none font-medium select-none has-[[data-slot=radio-group-item][data-checked]]:border-brand-light has-[[data-slot=radio-group-item][data-checked]]:ring-1 has-[[data-slot=radio-group-item][data-checked]]:ring-brand-light/20",
                  alignment === "start" ? "items-start" : "items-center",
                  optionDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer",
                )}
              >
                {radio}
                <span className="flex min-w-0 flex-col gap-1">
                  <span id={optionLabelId} className="text-sm font-semibold">
                    {option.label}
                  </span>
                  {option.description && (
                    <span
                      id={optionDescriptionId}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {option.description}
                    </span>
                  )}
                </span>
              </div>
            );
          }

          return (
            <div
              key={option.value}
              data-slot="radio-option"
              data-disabled={optionDisabled || undefined}
              onClick={selectFromOption}
              className={cn(
                "flex gap-1.5 text-sm leading-none font-medium select-none",
                alignment === "start" ? "items-start" : "items-center",
                optionDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer",
                option.value === value ? "" : "text-muted-foreground",
              )}
            >
              {radio}
              <span id={optionLabelId}>{option.label}</span>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
