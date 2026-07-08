import React from 'react';
import AdminDialog from '../AdminDialog';
import MediaLibrary from '../MediaLibrary';

/**
 * "Choose from uploaded" button + dialog. Lets the user pick an
 * already-uploaded image from the media inventory instead of uploading a new
 * file. Calls onSelect with BOTH the internal (host-stripped, project/env
 * prefixed) url and the absolute browser url, so callers can use whichever the
 * downstream save logic expects.
 */
export default class MediaLibraryPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {isOpen: false};
  }

  render() {
    const {isOpen} = this.state;
    const {onSelect, buttonLabel, buttonClass} = this.props;
    return (<>
      <button
        type="button"
        className={buttonClass || 'lh-btn lh-btn-brand-light text-sm'}
        onClick={() => this.setState({isOpen: true})}
      >
        {buttonLabel || 'Choose from uploaded'}
      </button>
      <AdminDialog
        title="Choose from uploaded images"
        isOpen={isOpen}
        setIsOpen={(v) => this.setState({isOpen: v})}
        widthClass="w-full max-w-5xl"
      >
        <MediaLibrary
          selectMode
          imagesOnly
          onSelect={(absoluteUrl, media) => {
            this.setState({isOpen: false});
            if (onSelect) {
              onSelect((media && media.url) || absoluteUrl, absoluteUrl, media);
            }
          }}
        />
      </AdminDialog>
    </>);
  }
}
