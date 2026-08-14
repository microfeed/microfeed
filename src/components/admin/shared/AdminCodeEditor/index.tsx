import CodeEditor from "@uiw/react-textarea-code-editor";
import {useRef} from "react";
import type {ChangeEventHandler, KeyboardEvent} from "react";

import {cn} from "@/lib/utils";

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
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  readOnly?: boolean;
}

export default function AdminCodeEditor({
  ariaLabel = "Code editor",
  code,
  fontSize = 12,
  language,
  maxHeight,
  minHeight = "50vh",
  onChange,
  placeholder = "Please enter code here, including html, javascript, and css",
  readOnly = false,
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
    className={cn(
      "block w-full min-w-0 max-w-full overflow-auto rounded-[10px] border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
      readOnly ? "bg-muted/60" : "bg-background",
    )}
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
      readOnly={readOnly}
      spellCheck={false}
      className="admin-code-editor w-full min-w-0 max-w-full"
      style={{
        minHeight,
        fontSize,
        backgroundColor: "transparent",
        fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
      }}
    />
  </label>);
}
