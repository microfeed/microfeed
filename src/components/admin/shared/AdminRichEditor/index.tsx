import React from "react";
import '@enzedonline/quill-blot-formatter2/dist/css/quill-blot-formatter2.css';
import 'quill/dist/quill.snow.css';
import {formatHtmlForEditing} from "@/client/HtmlUtils";
import AdminRadioGroup from "../AdminRadioGroup";
import AdminHtmlEditor from "../AdminHtmlEditor";
import RichEditorQuill from "./component/RichEditorQuill";

export default class AdminRichEditor extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      mode: 'rich',
      htmlSource: formatHtmlForEditing(props.value || ""),

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
    return (
      <div>
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
          value={value}
          onChange={this.onRichChange}
          extra={extra}
        /> : <AdminHtmlEditor value={htmlSource} onChange={this.onHtmlChange} />}
      </div>
    );
  }
}
