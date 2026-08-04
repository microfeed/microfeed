import {msToDatetimeLocalString, datetimeLocalToString} from '@/shared/TimeUtils';
import {Input} from "@/components/ui/input";

export default function AdminDatetimePicker({ label, value, onChange, labelComponent = null }: any) {
  return (<label className="">
    {label && <div className="mb-2 text-sm font-semibold text-foreground">{label}</div>}
    {labelComponent}
    <div className="w-full">
      <Input
        type="datetime-local"
        value={value ? msToDatetimeLocalString(value) : datetimeLocalToString(new Date())}
        className="w-full text-sm"
        onChange={onChange}
      />
    </div>
  </label>
);
}
