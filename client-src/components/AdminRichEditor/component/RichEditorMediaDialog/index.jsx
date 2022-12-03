import React from "react";
import AdminDialog from "../../../AdminDialog";

export default class RichEditorMediaDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
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
