import type {ReactNode} from "react";
import {LANGUAGE_CODES_LIST} from "@/shared/Constants";
import AdminSelect from "./AdminSelect";

const languageOptions = LANGUAGE_CODES_LIST.map(({name, code}) => ({
  value: code,
  textValue: `${name} ${code}`,
  label: <div>
    <div>{name}</div>
    <div className="text-muted-color text-sm">{code}</div>
  </div>,
}));

interface Props {
  id?: string;
  value?: string | null;
  inheritedLanguage?: string;
  label?: string;
  labelComponent?: ReactNode;
  ariaLabel?: string;
  onChange: (language: string) => void;
}

export default function AdminLanguageSelect({id, value, inheritedLanguage, label, labelComponent, ariaLabel = "Language", onChange}: Props) {
  const inheritedName = LANGUAGE_CODES_LIST.find(({code}) => code.toLowerCase() === inheritedLanguage?.toLowerCase())?.name;
  const inheritOption = {
    value: "",
    textValue: `Inherit from channel ${inheritedName ?? ""} ${inheritedLanguage ?? ""}`,
    label: <>Inherit from channel — {inheritedName || inheritedLanguage}</>,
  };
  const selected = languageOptions.find((option) => option.value.toLowerCase() === value?.toLowerCase());
  // Keep valid language overrides supplied through the API visible, including script variants.
  const customOption = value && !selected ? {value, textValue: value, label: <>{value}</>} : undefined;
  const options = [
    ...(inheritedLanguage ? [inheritOption] : []),
    ...languageOptions,
    ...(customOption ? [customOption] : []),
  ];
  return <AdminSelect
    id={id}
    ariaLabel={ariaLabel} label={label} labelComponent={labelComponent}
    options={options} value={selected ?? customOption ?? (inheritedLanguage ? inheritOption : undefined)}
    searchPlaceholder="Search languages…" onChange={(option) => onChange(option.value)}
  />;
}
