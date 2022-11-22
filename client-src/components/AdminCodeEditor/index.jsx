import React from "react";
import CodeEditor from "@uiw/react-textarea-code-editor";

export default function AdminCodeEditor(
  { code, language, onChange, placeholder = 'Please enter code here', minHeight = '50vh' }) {
  return (<label className="">
          <CodeEditor
            value={code}
            language={language}
            placeholder={placeholder}
            onChange={onChange}
            // prefixCls="h-1/2"
            style={{
              minHeight,
              overflow: 'auto',
              fontSize: 12,
              backgroundColor: "#f5f5f5",
              fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
            }}
          />
  </label>);
}
