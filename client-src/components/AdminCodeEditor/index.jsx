import React from "react";
import CodeEditor from "@uiw/react-textarea-code-editor";
import {pickDocumentText} from "../../common/LanguageUtils";

export default function AdminCodeEditor(
  {code, language, onChange, placeholder, minHeight = '50vh'}) {
  const finalPlaceholder = placeholder || pickDocumentText('请在这里输入代码', 'Type code here');
  return (<label className="">
    <CodeEditor
      value={code}
      language={language}
      placeholder={finalPlaceholder}
      onChange={onChange}
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
