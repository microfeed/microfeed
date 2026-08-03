import React from "react";
import '@enzedonline/quill-blot-formatter2/dist/css/quill-blot-formatter2.css';
import 'quill/dist/quill.snow.css';
import {formatHtmlForEditing} from "@/client/HtmlUtils";
import AdminRadio from "../AdminRadio";
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
        {label && <div className="lh-page-subtitle">
          {label}
        </div>}
        {labelComponent}
        <div className="mb-4 max-h-20">
          <AdminRadio
            customClass="text-sm text-helper-color"
            groupName="richOrHtml"
            buttons={[
              {value: 'rich', name: 'visual editor', checked: mode === 'rich'},
              {value: 'html', name: 'html source', checked: mode !== 'rich'},
            ]}
            onChange={(e: any) => this.setState({mode: e.target.value})}
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
