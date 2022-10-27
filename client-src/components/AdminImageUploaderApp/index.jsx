import React from 'react';

import clsx from 'clsx';

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
    if (!file) {
      return;
    }

    const errorMessage = isInvalidImage();
    if (errorMessage) {
      // TODO: show error message
      return;
    }

    this.setState({ uploadStatus: UPLOAD_STATUS__START });

    const {size, name, type} = file;
    const previewUrl = URL.createObjectURL(file);
    this.setState({currentImageUrl: previewUrl});
    const cdnFilename = `images/${name}`; // TODO: Generate filename
    const rawResponse = await fetch('/admin/ajax/r2-ops', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size,
        key: cdnFilename,
        type,
      })
    });
    const res = await rawResponse.json();
    const fileReader = new FileReader();
    fileReader.onloadend = async (e) => {
      const arrayBuffer = e.target.result;
      if (arrayBuffer) {
        const { mediaBaseUrl, presignedUrl } = res;
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            this.setState({progressText: `${parseFloat(event.loaded / event.total * 100.0).toFixed(2)}%`});
          }
        });
        xhr.addEventListener("loadend", () => {
          const mediaUrl = `${mediaBaseUrl}/${cdnFilename}`;
          if (xhr.readyState === 4 && xhr.status === 200) {
            this.props.onImageUploaded(mediaUrl);
          }
          this.setState({progressText: null, uploadStatus: null});
        });
        xhr.send(arrayBuffer);
      }
    };
    fileReader.readAsArrayBuffer(file);
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
