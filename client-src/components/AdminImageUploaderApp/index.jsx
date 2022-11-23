import React from 'react';
import clsx from 'clsx';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.min.css';
import {FileUploader} from "react-drag-drop-files";
import Requests from '../../common/requests';
import {randomHex} from '../../../common-src/StringUtils';
import AdminDialog from "../AdminDialog";
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import ExternalLink from "../ExternalLink";

const UPLOAD_STATUS__START = 1;

function EmptyImage({fileTypes}) {
  return (<div className="text-brand-light text-sm flex flex-col justify-center items-center h-full">
    <div className="mb-2">
      <CloudArrowUpIcon className="w-8" />
    </div>
    <div className="font-semibold">
      Click or drag here to upload image
    </div>
    <div className="mt-2">
      {fileTypes.join(',')}
    </div>
  </div>);
}

function PreviewImage({url, publicBucketUrl}) {
  // Relative url to website for default images, e.g., /assets/default/something.png
  // Relative url to cdn (r2), e.g., production/something.png
  const previewUrl = url.startsWith('/') ? url : `${publicBucketUrl}/${url}`;
  return (<div className="relative flex justify-center">
    <img
      src={previewUrl}
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

    const webGlobalSettings = props.feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';

    this.initState = {
      currentImageUrl: props.currentImageUrl || null,
      mediaType: props.mediaType || 'channel',
      uploadStatus: null,
      progressText: '0.00%',
      publicBucketUrl,

      showModal: false,
      previewImageUrl: null,
      cropper: null,
      cdnFilename: null,
      contentType: '',
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

    const {name, type} = file;
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
      contentType: type,
    })
  }

  onFileUploadToR2() {
    const {cropper, cdnFilename, contentType} = this.state;
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
        this.props.onImageUploaded(cdnUrl, contentType);
        cropper.destroy();
        this.setState({
          ...this.initState,
          currentImageUrl: cdnUrl,
        });
      });
    }, 'image/png');
  }

  render() {
    const {uploadStatus, currentImageUrl, progressText, showModal, previewImageUrl, imageWidth,
      imageHeight, publicBucketUrl} = this.state;
    const fileTypes = ['PNG', 'JPG', 'JPEG'];
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    const {imageSizeNotOkayFunc, imageSizeNotOkayMsgFunc} = this.props;
    const imageSizeNotOkay = imageSizeNotOkayFunc ? imageSizeNotOkayFunc(imageWidth, imageHeight) :
      imageWidth < 1400 || imageHeight < 1400;
    const imageSizeNotOkayMsg = imageSizeNotOkayMsgFunc ? imageSizeNotOkayMsgFunc(imageWidth, imageHeight) :
      `Image too small: ${parseInt(imageWidth)} x ${parseInt(imageHeight)} pixels. ` +
      "If it's for a podcast image, Apple Podcasts requires the image to have 1400 x 1400 to 3000 x 3000 pixels.";
    return (<div className="lh-upload-wrapper">
      <FileUploader
        handleChange={this.onFileUpload}
        name="imageUploader"
        types={fileTypes}
        disabled={uploading}
        classes="lh-upload-fileinput"
      >
        <div className="lh-upload-image-size lh-upload-box">
          {currentImageUrl ? <PreviewImage url={currentImageUrl} publicBucketUrl={publicBucketUrl}/> :
            <EmptyImage fileTypes={fileTypes} />}
        </div>
      </FileUploader>
      {currentImageUrl && <div className="text-sm flex justify-center mt-1">
        <ExternalLink text="preview image" url={currentImageUrl} />
      </div>}
      <AdminDialog
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
            disabled={uploading}
          >
            {uploading ? `Uploading... ${progressText}` : 'Upload'}
          </button>
        </div>
        {imageWidth > 0 && imageHeight > 0 && <div className={clsx("mt-2 text-xs text-center", imageSizeNotOkay ? 'text-red-500' : 'text-green-500')}>
          {imageSizeNotOkay ? <div>{imageSizeNotOkayMsg}</div> :
            <div>Image ok: {parseInt(imageWidth)} x {parseInt(imageHeight)} pixels.</div>}
        </div>}
      </AdminDialog>
    </div>);
  }
}
