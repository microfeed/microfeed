import React, {useState} from "react";
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import BlotFormatter from 'quill-blot-formatter';
import AdminRadio from "../AdminRadio";
import AdminTextarea from "../AdminTextarea";
import RichEditorMediaDialog from "./component/RichEditorMediaDialog";

// function imageHandler() {
//   const range = this.quill.getSelection();
//   const value = prompt('What is the image URL');
//   if (value) {
//     this.quill.insertEmbed(range.index, 'image', value, Quill.sources.USER);
//   }
// }
//
// function videoHandler() {
//   const range = this.quill.getSelection();
//   const value = prompt('What is the video URL');
//   if (value) {
//     this.quill.insertEmbed(range.index, 'video', value, Quill.sources.USER);
//   }
// }

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
      'video',
    ],
    ['clean']
  ];
  const modules = {
    toolbar: {
      container: toolbarOptions,
      // handlers: {
      //   image: imageHandler,
      //   video: videoHandler,
      // },
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
    'image', 'video',
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [quill, setQuill] = useState(null);

  return <div>
    <ReactQuill
      theme="snow"
      value={value || ''}
      onChange={onChange}
      modules={modules}
      formats={formats}
      ref={(ref) => {
        if (ref) {
          const editor = ref.getEditor();
          setQuill(editor);
          const toolbar = editor.getModule('toolbar');
          toolbar.addHandler('image', () => {
            setIsOpen(true);
            setMediaType('image');
          });
          toolbar.addHandler('video', () => {
            setIsOpen(true);
            setMediaType('video');
          });
        }
      }}
    />
    <RichEditorMediaDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      mediaType={mediaType}
      quill={quill}
    />
  </div>
}

export default class AdminRichEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'rich',

      isOpenImage: false,
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
