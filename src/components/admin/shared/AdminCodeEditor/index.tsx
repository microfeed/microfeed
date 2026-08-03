import CodeEditor from "@uiw/react-textarea-code-editor";
import type {ChangeEventHandler} from "react";

interface Props {
  ariaLabel?: string;
  code: string;
  language: string;
  maxHeight?: string;
  minHeight?: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
}

export default function AdminCodeEditor({
  ariaLabel = "Code editor",
  code,
  language,
  maxHeight,
  minHeight = "50vh",
  onChange,
  placeholder = "Please enter code here",
}: Props) {
  return (<label className="">
    <CodeEditor
      aria-label={ariaLabel}
      value={code}
      language={language}
      placeholder={placeholder}
      onChange={onChange}
      spellCheck={false}
      style={{
        maxHeight,
        minHeight,
        overflow: 'auto',
        fontSize: 12,
        backgroundColor: "#f5f5f5",
        fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
      }}
    />
  </label>);
}
