import React from "react";
import 'quill/dist/quill.snow.css';
import {formatHtmlForEditing} from "@/client/HtmlUtils";
import {stripTransientRichEditorAttributes} from "@/client/RichEditorMedia";
import AdminRadioGroup from "../AdminRadioGroup";
import AdminHtmlEditor from "../AdminHtmlEditor";
import RichEditorQuill from "./component/RichEditorQuill";

export default class AdminRichEditor extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      mode: 'rich',
      htmlSource: formatHtmlForEditing(
        stripTransientRichEditorAttributes(props.value || ""),
      ),

      isOpenImage: false,
    };
    this.onHtmlChange = this.onHtmlChange.bind(this);
    this.onRichChange = this.onRichChange.bind(this);
  }

  onHtmlChange(value: string) {
    this.setState({htmlSource: value});
    this.props.onChange(value);
  }

  onRichChange(value: string) {
    this.setState({htmlSource: formatHtmlForEditing(value)});
    this.props.onChange(value);
  }

  render() {
    const {htmlSource, mode} = this.state;
    const {label, value, extra, labelComponent} = this.props;
    const editorValue = stripTransientRichEditorAttributes(value || "");
    return (
      <div className="admin-rich-editor">
        {label && <div className="mb-2 font-semibold text-foreground">
          {label}
        </div>}
        {labelComponent}
        <div className="mb-4 max-h-20">
          <AdminRadioGroup
            ariaLabel="Editor mode"
            className="text-sm text-helper-color"
            name="richOrHtml"
            value={mode}
            options={[
              {value: 'rich', label: 'visual editor'},
              {value: 'html', label: 'html source'},
            ]}
            onValueChange={(value) => this.setState({mode: value})}
          />
        </div>
        {mode === 'rich' ? <RichEditorQuill
          value={editorValue}
          onChange={this.onRichChange}
          extra={extra}
        /> : <AdminHtmlEditor value={htmlSource} onChange={this.onHtmlChange} />}
      </div>
    );
  }
}
