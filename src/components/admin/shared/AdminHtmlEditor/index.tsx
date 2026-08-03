import type {ChangeEvent} from "react";

import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";

interface Props {
  onChange: (value: string) => void;
  value?: string;
}

export default function AdminHtmlEditor({onChange, value = ""}: Props) {
  const onCodeChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <AdminCodeEditor
      ariaLabel="HTML source"
      code={value}
      language="html"
      maxHeight="32rem"
      minHeight="16rem"
      onChange={onCodeChange}
      placeholder="Enter HTML source"
    />
  );
}
