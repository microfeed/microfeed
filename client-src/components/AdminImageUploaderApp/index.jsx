import React from 'react';
import clsx from 'clsx';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.min.css';
import {FileUploader} from "react-drag-drop-files";
import Requests from '../../common/requests';
import {randomHex} from '../../../common-src/StringUtils';
import LhDialog from "../LhDialog";

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

function PreviewImage({url}) {
  return (<div className="relative flex justify-center">
    <img
      src={url}
      className={clsx('lh-upload-image-size object-cover', 'gradient-mask-b-20')}
    />
    <div className="absolute bottom-4 text-sm font-normal text-brand-light">
      <em>
        Click or drag here to change image
      </em>
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
    this.onFileUploadToR2 = this.onFileUploadToR2.bind(this);

    this.initState = {
      currentImageUrl: props.currentImageUrl || null,
      mediaType: props.mediaType || 'pod',
      uploadStatus: null,
      progressText: '0.00%',

      showModal: false,
      previewImageUrl: null,
      cropper: null,
      cdnFilename: null,
      imageWidth: 0,
      imageHeight: 0,
    };

    this.state = {
      ...this.initState,
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

  onFileUpload(file) {
    const {mediaType} = this.state;
    if (!file) {
      return;
    }

    const errorMessage = isInvalidImage();
    if (errorMessage) {
      // TODO: show error message
      return;
    }

    const {name} = file;
    const extension = name.slice((name.lastIndexOf(".") - 1 >>> 0) + 2);
    let newFilename = `${mediaType}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    const previewUrl = URL.createObjectURL(file);
    this.setState({
      previewImageUrl: previewUrl,
      showModal: true,
      cdnFilename: `images/${newFilename}`,
    })
  }

  onFileUploadToR2() {
    const {cropper, cdnFilename} = this.state;
    if (!cropper) {
      return;
    }
    this.setState({ uploadStatus: UPLOAD_STATUS__START });
    cropper.getCroppedCanvas().toBlob((blob) => {
      cropper.disable();

      Requests.upload(blob, cdnFilename, (percentage) => {
        this.setState({
          progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`,
        });
      }, (cdnUrl) => {
        this.props.onImageUploaded(cdnUrl);
        cropper.destroy();
        this.setState({
          ...this.initState,
          currentImageUrl: cdnUrl,
        });
      });
    }, 'image/png');
  }

  render() {
    const {uploadStatus, currentImageUrl, progressText, showModal, previewImageUrl, imageWidth, imageHeight} = this.state;
    const fileTypes = ['PNG', 'JPG', 'JPEG'];
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    const sizeTooSmall = imageWidth < 1400 || imageHeight < 1400;
    return (<div className="lh-upload-wrapper">
      <FileUploader
        handleChange={this.onFileUpload}
        name="imageUploader"
        types={fileTypes}
        disabled={uploading}
        classes="lh-upload-fileinput"
      >
        <div className="lh-upload-image-size lh-upload-box">
          {currentImageUrl ? <PreviewImage url={currentImageUrl}/> :
            <EmptyImage fileTypes={fileTypes} />}
        </div>
      </FileUploader>
      {currentImageUrl && <div className="text-sm text-center">
        <a href={currentImageUrl} target="_blank">preview image</a>
      </div>}
      <LhDialog
        isOpen={showModal}
        setIsOpen={(trueOrFalse) => this.setState({showModal: trueOrFalse})}
        disabledClose={uploading}
      >
        {previewImageUrl && <div>
          <img
            className="w-full"
            src={previewImageUrl}
            onLoad={(e) => {
              const {clientWidth, clientHeight} = e.target;
              const size = Math.min(clientWidth, clientHeight);
              const options = {
                aspectRatio: 1.0,
                viewMode: 3,
                cropBoxResizable: true,
                crop: (event) => {
                  const {width, height} = event.detail;
                  this.setState({imageWidth: width, imageHeight: height});
                },
                ready: () => {
                  cropper.setCropBoxData({width: size, height: size});
                }
              };
              // if (clientWidth === clientHeight) {
              //   options.minCropBoxHeight = size;
              //   options.minCropBoxWidth = size;
              //   options.cropBoxResizable = false;
              // }
              const cropper = new Cropper(e.target, options);
              this.setState({cropper});
            }}
          />
        </div>}
        <div className="mt-4 flex justify-center">
          <button
            className="lh-btn lh-btn-brand-dark"
            onClick={this.onFileUploadToR2}
            disabled={uploading || sizeTooSmall}
          >
            {uploading ? `Uploading... ${progressText}` : 'Upload'}
          </button>
        </div>
        {imageWidth > 0 && imageHeight > 0 && <div className={clsx("mt-2 text-xs text-center", sizeTooSmall ? 'text-red-500' : 'text-green-500')}>
          {sizeTooSmall ? <div>Image too small: {parseInt(imageWidth)} x {parseInt(imageHeight)} pixels. Please make sure the image has 1400 x 1400 to 3000 x 3000 pixels.</div> :
            <div>Image ok: {parseInt(imageWidth)} x {parseInt(imageHeight)} pixels.</div>}
        </div>}
      </LhDialog>
    </div>);
  }
}
