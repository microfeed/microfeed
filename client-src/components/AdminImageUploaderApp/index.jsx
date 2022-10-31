import React from 'react';
import clsx from 'clsx';
import Requests from '../../common/requests';
import {randomHex} from '../../../common-src/StringUtils';

const UPLOAD_STATUS__START = 1;

function EmptyImage() {
  return (<div className="border h-full flex justify-center items-center bg-gray-400 hover:opacity-50">
    <span className="text-white">Upload image</span>
  </div>);
}

function PreviewImage({url, progressText}) {
  return (<div className="relative flex justify-center">
    <img
      src={url}
      className={clsx('lh-upload-image-size border object-cover', 'gradient-mask-b-80')}
    />
    <div className="absolute bottom-4 text-sm font-normal text-brand-light">
      {progressText ? <em>uploading: {progressText}</em> : <em>click to change image</em>}
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
      previousImageUrl: null,
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

  async onFileUpload(event) {
    const [file] = event.target.files;
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
      this.props.onImageUploaded(cdnUrl);
      this.setState({progressText: null, uploadStatus: null});
    });
  }

  render() {
    const {currentImageUrl, progressText} = this.state;
    return (<div className="lh-upload-image-size">
      <input
        type="file"
        className="hidden"
        ref={(c) => this.inputFile = c}
        onChange={this.onFileUpload}
      />
      <a href="#" onClick={this.onFileUploadClick}>
        {currentImageUrl ? <PreviewImage url={currentImageUrl} progressText={progressText} /> : <EmptyImage/>}
      </a>
    </div>);
  }
}
