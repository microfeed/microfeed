import React from 'react';
import clsx from 'clsx';
import {FileUploader} from "react-drag-drop-files";
import Requests from '../../common/requests';
import {randomHex} from '../../../common-src/StringUtils';

const UPLOAD_STATUS__START = 1;

function EmptyImage({fileTypes}) {
  return (<div className="text-brand-light text-sm flex flex-col justify-center items-center h-full">
    <div className="font-semibold">
      Click or drag here to upload image
    </div>
    <div className="mt-2">
      {fileTypes.join(',')}
    </div>
  </div>);
}

function PreviewImage({url, progressText}) {
  return (<div className="relative flex justify-center">
    <img
      src={url}
      className={clsx('lh-upload-image-size object-cover', 'gradient-mask-b-20')}
    />
    <div className="absolute bottom-4 text-sm font-normal text-brand-light">
      {progressText ? <em>uploading: {progressText}</em> : <em>
        click or drag here to change image
      </em>}
    </div>
  </div>);
}

function isInvalidImage() {
  // TODO: implement it -
  // - check if it's image
  // - square size
  // - at least 1400x1400
  // - ...
  // return 'error message'
}

export default class AdminImageUploaderApp extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUploadClick = this.onFileUploadClick.bind(this);
    this.onFileUpload = this.onFileUpload.bind(this);

    this.state = {
      currentImageUrl: props.currentImageUrl || null,
      uploadStatus: null,
      progressText: null,
      mediaType: props.mediaType || 'pod',
    };
  }

  componentDidMount() {
  }

  onFileUploadClick(e) {
    e.preventDefault();
    if (!this.inputFile) {
      return;
    }
    const {uploadStatus} = this.state;
    if (uploadStatus === UPLOAD_STATUS__START) {
      return;
    }

    this.inputFile.click();
  }

  async onFileUpload(file) {
    const {mediaType} = this.state;
    if (!file) {
      return;
    }

    const errorMessage = isInvalidImage();
    if (errorMessage) {
      // TODO: show error message
      return;
    }

    this.setState({ uploadStatus: UPLOAD_STATUS__START });

    const {name} = file;
    const extension = name.slice((name.lastIndexOf(".") - 1 >>> 0) + 2);
    let newFilename = `${mediaType}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    const previewUrl = URL.createObjectURL(file);
    this.setState({currentImageUrl: previewUrl});
    const cdnFilename = `images/${newFilename}`;
    Requests.upload(file, cdnFilename, (percentage) => {
      this.setState({progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl) => {
      console.log(cdnUrl);
      this.props.onImageUploaded(cdnUrl);
      this.setState({currentImageUrl: cdnUrl, progressText: null, uploadStatus: null});
    });
  }

  render() {
    const {uploadStatus, currentImageUrl, progressText} = this.state;
    const fileTypes = ['PNG', 'JPG', 'JPEG'];
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div className="lh-upload-wrapper">
      <FileUploader
        handleChange={this.onFileUpload}
        name="imageUploader"
        types={fileTypes}
        disabled={uploading}
        classes="lh-upload-fileinput"
      >
        <div className="lh-upload-image-size lh-upload-box">
          {currentImageUrl ? <PreviewImage url={currentImageUrl} progressText={progressText}/> :
            <EmptyImage fileTypes={fileTypes} />}
        </div>
      </FileUploader>
      {currentImageUrl && <div className="text-sm text-center">
        <a href={currentImageUrl} target="_blank">preview image</a>
      </div>}
    </div>);
  }
}
