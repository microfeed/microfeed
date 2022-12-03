import React from "react";
import ReactQuill, {Quill} from "react-quill";
import BlotFormatter from "quill-blot-formatter";
import RichEditorMediaDialog from "../RichEditorMediaDialog";

Quill.register({
  'modules/blotFormatter': BlotFormatter,
});

const toolbarOptions = [
  [{'header': [2, 3, false]}],
  ['bold', 'italic', 'underline', 'blockquote', 'code-block'],
  [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
  ['link', 'image', 'video'],
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

export default class RichEditorQuill extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      mediaType: 'image',
    };
  }

  render() {
    const {value, onChange} = this.props;
    const {isOpen, mediaType} = this.state;
    return <div>
    <ReactQuill
      theme="snow"
      value={value || ''}
      onChange={onChange}
      modules={modules}
      formats={formats}
      ref={(ref) => {
        if (ref) {
          this.quill = ref.getEditor();
          const toolbar = this.quill.getModule('toolbar');
          toolbar.addHandler('image', () => {
            this.setState({isOpen: true, mediaType: 'image'});
          });
          toolbar.addHandler('video', () => {
            this.setState({isOpen: true, mediaType: 'video'});
          });
        }
      }}
    />
    <RichEditorMediaDialog
      isOpen={isOpen}
      setIsOpen={(isOpen) => this.setState({isOpen})}
      mediaType={mediaType}
      quill={this.quill}
    />
  </div>
  }
}
