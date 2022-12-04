import React from "react";
import {Quill} from "react-quill";
import AdminDialog from "../../../AdminDialog";
import AdminRadio from "../../../AdminRadio";
import AdminInput from "../../../AdminInput";

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

function FromUrl({url, onChange, onInsert}) {
  let disabled = false;
  if (!url || url.length <= 3) {
    disabled = true;
  }
  return (<form>
    <div>
      <AdminInput
        value={url}
        type="url"
        placeholder="e.g., https://example.com/something.jpg"
        onChange={onChange}
      />
    </div>
    <div className="py-4 flex justify-center">
      <button type="submit" className="lh-btn lh-btn-brand-dark" disabled={disabled} onClick={onInsert}>
        Insert
      </button>
    </div>
  </form>);
}

function UploadNewFile() {
  return (<div>
    upload new file
  </div>);
}

export default class RichEditorMediaDialog extends React.Component {
  constructor(props) {
    super(props);
    this.insertMedia = this.insertMedia.bind(this);

    this.state = {
      url: null,
      mode: 'url',
    };
  }

  insertMedia() {
    const {quill, quillSelection, mediaType} = this.props;
    if (!quill) {
      return;
    }
    const {url} = this.state;
    if (url) {
      const index = quillSelection ? quillSelection.index : 0;
      quill.insertEmbed(index, mediaType, url, Quill.sources.USER);
      this.setState({url: null});
    }
  }

  render() {
    const {
      isOpen,
      setIsOpen,
      mediaType,
      // quill,
    } = this.props;
    const {mode, url} = this.state;
    const disabledClose = false;
    // console.log(quill);
    return (
      <AdminDialog
        title={`Insert ${mediaType}`}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        disabledClose={disabledClose}
      >
        <div className="pt-4 pb-8">
          <AdminRadio
            groupName="media-insert"
            customClass="text-sm font-semibold"
            buttons={[
              {
                'name': 'Upload a new file',
                'value': 'upload',
                'checked': mode === 'upload',
              },
              {
                'name': 'From URL',
                'value': 'url',
                'checked': mode === 'url',
              },
            ]}
            onChange={(e) => {
              this.setState({mode: e.target.value});
            }}
            disabled={false}
          />
        </div>
        <div>
          {mode === 'upload' ?
            <UploadNewFile
            /> : <FromUrl
              url={url}
              onChange={(e) => this.setState({url: e.target.value})}
              onInsert={(e) => {
                e.preventDefault();
                this.insertMedia();
                setIsOpen(false);
              }}
            />}
        </div>
      </AdminDialog>
    );
  }
}
