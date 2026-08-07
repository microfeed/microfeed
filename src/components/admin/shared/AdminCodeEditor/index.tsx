import CodeEditor from "@uiw/react-textarea-code-editor";
import {useRef} from "react";
import type {ChangeEventHandler, KeyboardEvent} from "react";

export function isCaretOnLastLine(
  value: string,
  selectionStart: number,
  selectionEnd: number,
) {
  return selectionStart === selectionEnd
    && !value.slice(selectionEnd).includes("\n");
}

interface Props {
  ariaLabel?: string;
  code: string;
  fontSize?: number | string;
  language: string;
  maxHeight?: string;
  minHeight?: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
}

export default function AdminCodeEditor({
  ariaLabel = "Code editor",
  code,
  fontSize = 12,
  language,
  maxHeight,
  minHeight = "50vh",
  onChange,
  placeholder = "Please enter code here",
}: Props) {
  const scrollContainerRef = useRef<HTMLLabelElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter"
      || event.defaultPrevented
      || event.nativeEvent.isComposing
      || !isCaretOnLastLine(
        event.currentTarget.value,
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd,
      )
    ) {
      return;
    }

    event.currentTarget.ownerDocument.defaultView?.requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });
  };

  return (<label
    className="block overflow-auto rounded-[10px] border bg-muted/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
    ref={scrollContainerRef}
    style={{maxHeight}}
  >
    <CodeEditor
      aria-label={ariaLabel}
      value={code}
      language={language}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
      spellCheck={false}
      className="admin-code-editor"
      style={{
        minHeight,
        fontSize,
        backgroundColor: "transparent",
        fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
      }}
    />
  </label>);
}
