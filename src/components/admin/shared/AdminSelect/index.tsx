import {useRef, useState, type ReactNode} from "react";

import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

export interface AdminSelectOption {
  label: ReactNode;
  textValue?: string;
  value: string;
}

interface CommonProps<Option extends AdminSelectOption> {
  ariaLabel?: string;
  disabled?: boolean;
  emptyText?: string;
  isOptionDisabled?: (option: Option) => boolean;
  label?: ReactNode;
  labelComponent?: ReactNode;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
}

interface SingleProps<Option extends AdminSelectOption> extends CommonProps<Option> {
  multiple?: false;
  onChange: (option: Option) => void;
  value?: Option | null;
}

interface MultipleProps<Option extends AdminSelectOption> extends CommonProps<Option> {
  multiple: true;
  onChange: (options: Option[]) => void;
  value: Option[];
}

export type AdminSelectProps<Option extends AdminSelectOption> =
  | SingleProps<Option>
  | MultipleProps<Option>;

const ADMIN_SELECT_CONTROL_CLASS =
  "min-h-[38px] rounded-[4px] border-black bg-white focus-within:border-[#2684ff] focus-within:ring-1 focus-within:ring-[#2684ff] dark:bg-white";
const ADMIN_SELECT_INDICATORS_CLASS =
  "my-2 flex shrink-0 self-stretch items-center border-l border-[#cccccc] px-0.5";
const ADMIN_SELECT_TRIGGER_CLASS =
  "size-8 rounded-none px-0 focus-visible:ring-0";

const optionText = <Option extends AdminSelectOption>(option: Option) =>
  option.textValue ?? (typeof option.label === "string" ? option.label : option.value);

export default function AdminSelect<Option extends AdminSelectOption>(
  props: AdminSelectProps<Option>,
) {
  const {
    ariaLabel,
    disabled = false,
    emptyText = "No options found.",
    isOptionDisabled = () => false,
    label,
    labelComponent = null,
    options,
    placeholder = "Select...",
    searchPlaceholder = placeholder,
  } = props;
  const anchorRef = useRef<HTMLDivElement>(null);
  const [singleInputValue, setSingleInputValue] = useState("");
  const [singleOpen, setSingleOpen] = useState(false);
  const accessibleLabel = ariaLabel ??
    (typeof label === "string" ? label : "Select an option");
  const visibleOptions = props.multiple
    ? options.filter((option) => !props.value.some(
      (selected) => selected.value === option.value,
    ))
    : options;
  const commonRootProps = {
    autoHighlight: true,
    disabled,
    isItemEqualToValue: (option: Option, selected: Option) =>
      option.value === selected.value,
    itemToStringLabel: optionText<Option>,
    itemToStringValue: (option: Option) => option.value,
    items: visibleOptions,
  };
  const optionList = (
    <>
      <ComboboxEmpty className="px-3 py-2">{emptyText}</ComboboxEmpty>
      <ComboboxList className="p-1">
        {(option: Option) => (
          <ComboboxItem
            key={option.value}
            value={option}
            disabled={isOptionDisabled(option)}
            className="min-h-9 rounded-none px-3 py-2 text-sm text-black data-highlighted:bg-[#deebff] data-highlighted:text-black data-selected:bg-[#2684ff] data-selected:text-white [&_[data-slot=combobox-item-indicator]]:hidden"
          >
            {option.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </>
  );

  return (
    <div className="w-full">
      {label && <div className="lh-page-subtitle">{label}</div>}
      {labelComponent}
      {props.multiple ? (
        <Combobox
          {...commonRootProps}
          multiple
          value={props.value}
          onValueChange={props.onChange}
        >
          <ComboboxInputGroup ref={anchorRef} className={ADMIN_SELECT_CONTROL_CLASS}>
            <ComboboxChips className="min-h-9 gap-1 px-1.5 py-0.5">
              <ComboboxValue>
                {(selectedOptions: Option[]) => (
                  <>
                    {selectedOptions.map((option) => (
                      <ComboboxChip
                        key={option.value}
                        aria-label={optionText(option)}
                        className="h-auto min-h-6 gap-0 rounded-[2px] bg-[#e6e6e6] pr-1 pl-2 text-sm font-normal"
                      >
                        {option.label}
                        <ComboboxChipRemove
                          aria-label={`Remove ${optionText(option)}`}
                          className="text-black hover:bg-[#ffbdad] hover:text-[#de350b] focus-visible:ring-1 focus-visible:ring-[#2684ff]"
                        />
                      </ComboboxChip>
                    ))}
                    <ComboboxInput
                      aria-label={accessibleLabel}
                      placeholder={selectedOptions.length > 0 ? "" : placeholder}
                      disabled={disabled}
                      className="h-9 px-1 py-1 text-sm"
                    />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <div className={ADMIN_SELECT_INDICATORS_CLASS}>
              {props.value.length > 0 && (
                <ComboboxClear
                  aria-label={`Clear ${accessibleLabel}`}
                  disabled={disabled}
                  className="size-8 rounded-none hover:bg-transparent hover:text-[#de350b] focus-visible:ring-0"
                />
              )}
              <ComboboxTrigger
                aria-label={`Open ${accessibleLabel}`}
                className={ADMIN_SELECT_TRIGGER_CLASS}
                disabled={disabled}
              />
            </div>
          </ComboboxInputGroup>
          <ComboboxContent
            anchor={anchorRef}
            aria-label={accessibleLabel}
            sideOffset={8}
            className="rounded-[4px] bg-white text-black shadow-md ring-1 ring-black/15"
          >
            {optionList}
          </ComboboxContent>
        </Combobox>
      ) : (
        <Combobox
          {...commonRootProps}
          value={props.value ?? null}
          inputValue={singleInputValue}
          onInputValueChange={(inputValue, eventDetails) => {
            if (eventDetails.reason === "input-change") {
              setSingleInputValue(inputValue);
            }
          }}
          onOpenChange={(open) => {
            setSingleOpen(open);
            if (!open) {
              setSingleInputValue("");
            }
          }}
          onValueChange={(option) => {
            if (option) {
              setSingleInputValue("");
              props.onChange(option);
            }
          }}
        >
          <ComboboxInputGroup ref={anchorRef} className={ADMIN_SELECT_CONTROL_CLASS}>
            <div
              data-slot="admin-select-input-container"
              className="relative ml-1 flex min-h-9 min-w-0 flex-1 items-stretch"
            >
              {props.value && (
                <ComboboxValue>
                  {(option: Option | null) => option && (
                    <div
                      data-slot="admin-select-value"
                      className={singleInputValue === ""
                        ? "pointer-events-none flex min-w-0 flex-1 items-center overflow-hidden px-2.5 py-1 text-sm"
                        : "invisible flex min-w-0 flex-1 items-center overflow-hidden px-2.5 py-1 text-sm"
                      }
                    >
                      {option.label}
                    </div>
                  )}
                </ComboboxValue>
              )}
              <ComboboxInput
                aria-label={accessibleLabel}
                className={props.value
                  ? `absolute inset-0 h-full w-full px-2.5 py-1 text-sm ${singleInputValue === "" ? "caret-transparent text-transparent" : "text-black"}`
                  : "h-9 w-full px-2.5 py-1 text-sm"
                }
                placeholder={props.value
                  ? ""
                  : (singleOpen ? searchPlaceholder : placeholder)
                }
                disabled={disabled}
              />
            </div>
            <div className={ADMIN_SELECT_INDICATORS_CLASS}>
              <ComboboxTrigger
                aria-label={`Open ${accessibleLabel}`}
                className={ADMIN_SELECT_TRIGGER_CLASS}
                disabled={disabled}
              />
            </div>
          </ComboboxInputGroup>
          <ComboboxContent
            anchor={anchorRef}
            aria-label={accessibleLabel}
            sideOffset={8}
            className="rounded-[4px] bg-white text-black shadow-md ring-1 ring-black/15"
          >
            {optionList}
          </ComboboxContent>
        </Combobox>
      )}
    </div>
  );
}
