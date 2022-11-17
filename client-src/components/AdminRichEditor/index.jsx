import React from "react";
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import BlotFormatter from 'quill-blot-formatter';
import AdminRadio from "../AdminRadio";
import AdminTextarea from "../AdminTextarea";

function imageHandler() {
  const range = this.quill.getSelection();
  const value = prompt('What is the image URL');
  if (value) {
    this.quill.insertEmbed(range.index, 'image', value, Quill.sources.USER);
  }
}

Quill.register({
  'modules/blotFormatter': BlotFormatter,
});

function AdminRichEditorRichMode({value, onChange}) {
  const toolbarOptions = [
    [{'header': [2, 3, false]}],
    ['bold', 'italic', 'underline', 'blockquote', 'code-block'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    [
      'link',
      'image',
    ],
    ['clean']
  ];
  const modules = {
    toolbar: {
      container: toolbarOptions,
      handlers: {
        image: imageHandler,
      },
    },
    blotFormatter: {
      // see config options below
    },
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'blockquote', 'code-block',
    'list', 'bullet', 'indent',
    'link',
    'image',
  ];
  return <div>
    <ReactQuill
      theme="snow"
      value={value || ''}
      onChange={onChange}
      modules={modules}
      formats={formats}
    />
  </div>
}

export default class AdminRichEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'rich',
    };
  }
  render() {
    const {mode} = this.state;
    const {label, value, onChange} = this.props;
    return (
      <div>
        <div className="lh-page-subtitle">
          {label}
        </div>
        <div className="mb-2 max-h-20">
          <AdminRadio
            customLabelClass="text-sm text-helper-color"
            groupName="richOrHtml"
            buttons={[
              {value: 'rich', name: 'WYSIWYG', checked: mode === 'rich'},
              {value: 'html', name: 'HTML Source', checked: mode !== 'rich'},
            ]}
            onChange={(e) => this.setState({mode: e.target.value})}
          />
        </div>
        {mode === 'rich' ? <AdminRichEditorRichMode
          value={value}
          onChange={onChange}
        /> : <AdminTextarea value={value} maxRows={20} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }
}
