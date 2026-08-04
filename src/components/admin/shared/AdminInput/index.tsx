import clsx from "clsx";

import {Input} from "@/components/ui/input";

export default function AdminInput(
  { label, value, onChange, labelComponent = null, placeholder = '', disabled = false,
    setRef = () => {}, customLabelClass = '', customClass = '', type = 'text',
    extraParams = {} }: any) {
  return (<label className="w-full">
    {label && <div className={clsx(customLabelClass || "mb-2 text-sm font-semibold text-foreground")}>{label}</div>}
    {labelComponent}
    <div className="w-full">
      <Input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        ref={(ref: any) => setRef(ref)}
        className={clsx("w-full", customClass || "text-sm", disabled && "bg-muted")}
        disabled={disabled}
        {...extraParams}
      />
    </div>
  </label>);
}
