import React from "react";
import AdminDialog from "../../../AdminDialog";

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

export default class RichEditorMediaDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      url: null,
    };
  }

  render() {
    const {
      isOpen,
      setIsOpen,
      mediaType,
      quill,
    } = this.props;
    const disabledClose = false;
    console.log(quill);
    return (
      <AdminDialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        disabledClose={disabledClose}
      >
        Insert {mediaType}
      </AdminDialog>
    );
  }
}
