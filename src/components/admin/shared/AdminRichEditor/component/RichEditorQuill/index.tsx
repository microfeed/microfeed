import React from "react";
import BlotFormatter from "@enzedonline/quill-blot-formatter2";
import Quill, {type Delta, type EmitterSource} from "quill";
import RichEditorMediaDialog from "../RichEditorMediaDialog";

Quill.register('modules/blotFormatter2', BlotFormatter);

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
  blotFormatter2: {
    // see config options below
  },
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'blockquote', 'code-block',
  'list', 'indent',
  'link',
  'image', 'video',
];

export default class RichEditorQuill extends React.Component<any, any> {
  editorElement: HTMLDivElement | null = null;
  quillRef: Quill | null = null;
  textChangeHandler:
    | ((delta: Delta, oldDelta: Delta, source: EmitterSource) => void)
    | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      isOpen: false,
      mediaType: 'image',
      quillSelection: null,
    };
  }

  componentDidMount() {
    if (!this.editorElement) {
      return;
    }
    const editor = new Quill(this.editorElement, {
      formats,
      modules,
      theme: 'snow',
    });
    this.quillRef = editor;
    const initialValue = this.props.value || '';
    if (initialValue) {
      editor.clipboard.dangerouslyPasteHTML(initialValue, 'silent');
    }
    this.textChangeHandler = (_delta, _oldDelta, source) => {
      if (source !== 'silent') {
        this.props.onChange(editor.root.innerHTML);
      }
    };
    editor.on('text-change', this.textChangeHandler);

    const toolbar = editor.getModule('toolbar') as {
      addHandler: (format: string, handler: () => void) => void;
    };
    toolbar.addHandler('image', () => {
      this.setState({
        isOpen: true,
        mediaType: 'image',
        quillSelection: editor.getSelection(),
      });
    });
    toolbar.addHandler('video', () => {
      this.setState({
        isOpen: true,
        mediaType: 'video',
        quillSelection: editor.getSelection(),
      });
    });
  }

  componentDidUpdate(previousProps: any) {
    if (
      this.quillRef &&
      previousProps.value !== this.props.value
    ) {
      const nextValue = this.props.value || '';
      const currentValue = this.quillRef.root.innerHTML;
      const emptyValuesMatch =
        !nextValue && currentValue === '<p><br></p>';
      if (!emptyValuesMatch && nextValue !== currentValue) {
        const selection = this.quillRef.getSelection();
        this.quillRef.clipboard.dangerouslyPasteHTML(nextValue, 'silent');
        if (selection) {
          const maxIndex = Math.max(0, this.quillRef.getLength() - 1);
          this.quillRef.setSelection(
            Math.min(selection.index, maxIndex),
            Math.min(selection.length, maxIndex),
            'silent',
          );
        }
      }
    }
  }

  componentWillUnmount() {
    if (this.quillRef && this.textChangeHandler) {
      this.quillRef.off('text-change', this.textChangeHandler);
    }
    this.textChangeHandler = null;
    this.quillRef = null;
  }

  render() {
    const {extra} = this.props;
    const {isOpen, mediaType, quillSelection} = this.state;
    return <div>
    <div ref={(element) => {
      this.editorElement = element;
    }} />
    <RichEditorMediaDialog
      isOpen={isOpen}
      setIsOpen={(isOpen: any) => this.setState({isOpen})}
      mediaType={mediaType}
      quill={this.quillRef}
      quillSelection={quillSelection}
      extra={extra}
    />
  </div>
  }
}
