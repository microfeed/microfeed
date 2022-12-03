import React from "react";

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
    } = this.props;
    return (
      <AdminDialog
        title={`Insert ${mediaType}`}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      >
        hello
      </AdminDialog>
    );
  }
}
