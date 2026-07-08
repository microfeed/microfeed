import React from 'react';
import clsx from 'clsx';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.min.css';
import {FileUploader} from "react-drag-drop-files";
import Requests from '../../common/requests';
import {randomHex, urlJoinWithRelative} from '../../../common-src/StringUtils';
import {
  classifyImageFieldFile,
  getImageFieldAcceptedFileTypes,
  getNormalizedSquareOutputSize,
  isImageFieldCompatibleStoredMedia,
  readImageDimensions,
} from "../../common/imageFieldUploadPipeline";
import AdminDialog from "../AdminDialog";
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import ExternalLink from "../ExternalLink";
import MediaLibraryPicker from "../MediaLibraryPicker";
import {showToast} from "../../common/ToastUtils";

const UPLOAD_STATUS__START = 1;
const IMAGE_FIELD_FILE_TYPES = getImageFieldAcceptedFileTypes();

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

export default class AdminImageUploaderApp extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUploadClick = this.onFileUploadClick.bind(this);
    this.onFileUpload = this.onFileUpload.bind(this);
    this.onFileUploadToR2 = this.onFileUploadToR2.bind(this);

    const webGlobalSettings = props.feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';

    this.initState = {
      currentImageUrl: props.currentImageUrl,
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
      selectedClassification: null,
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

    const classification = classifyImageFieldFile(file);
    const newFilename = `${mediaType}-${randomHex(32)}.${classification.outputExtension}`;

    if (classification.kind !== "raster") {
      this.setState({
        uploadStatus: UPLOAD_STATUS__START,
        progressText: '0.00%',
        cdnFilename: `images/${newFilename}`,
        contentType: classification.outputContentType,
      }, async () => {
        const dimensions = await readImageDimensions(file);
        Requests.upload(
          file,
          `images/${newFilename}`,
          (percentage) => {
            this.setState({
              progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`,
            });
          },
          (cdnUrl, _arrayBuffer, meta) => {
            this.props.onImageUploaded(cdnUrl, classification.outputContentType, meta || dimensions);
            this.setState({
              ...this.initState,
              currentImageUrl: cdnUrl,
            });
          },
          () => {
            showToast('Failed to upload. Please refresh this page and try again.', 'error', 2000);
            this.setState({...this.initState});
          },
          (error) => {
            this.setState({...this.initState}, () => {
              if (!error.response) {
                showToast('Network error. Please refresh the page and try again.', 'error');
              } else {
                showToast('Failed. Please try again.', 'error');
              }
            });
          },
          dimensions,
        );
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    this.setState({
      previewImageUrl: previewUrl,
      showModal: true,
      cdnFilename: `images/${newFilename}`,
      contentType: classification.outputContentType,
      selectedClassification: classification,
    });
  }

  onFileUploadToR2() {
    const {cropper, cdnFilename, contentType} = this.state;
    if (!cropper) {
      return;
    }
    this.setState({ uploadStatus: UPLOAD_STATUS__START });
    const imageData = cropper.getImageData ? cropper.getImageData() : {};
    const targetSize = getNormalizedSquareOutputSize(
      imageData.naturalWidth || imageData.width || 0,
      imageData.naturalHeight || imageData.height || 0,
    );
    cropper.getCroppedCanvas({
      width: targetSize,
      height: targetSize,
      imageSmoothingQuality: 'high',
    }).toBlob((blob) => {
      cropper.disable();

      Requests.upload(blob, cdnFilename, (percentage) => {
        this.setState({
          progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`,
        });
      }, (cdnUrl, _arrayBuffer, meta) => {
        this.props.onImageUploaded(cdnUrl, contentType, meta || {width: targetSize, height: targetSize});
        cropper.destroy();
        this.setState({
          ...this.initState,
          currentImageUrl: cdnUrl,
        });
      }, () => {
        showToast('Failed to upload. Please refresh this page and try again.', 'error', 2000);
        this.setState({...this.initState});
      }, (error) => {
        this.setState({...this.initState}, () => {
          if (!error.response) {
            showToast('Network error. Please refresh the page and try again.', 'error');
          } else {
            showToast('Failed. Please try again.', 'error');
          }
        });
      }, {width: targetSize, height: targetSize});
    }, 'image/avif', 0.8);
  }

  render() {
    const {uploadStatus, currentImageUrl, progressText, showModal, publicBucketUrl, previewImageUrl, imageWidth, imageHeight} = this.state;
    const absoluteImageUrl =  currentImageUrl ? urlJoinWithRelative(publicBucketUrl, currentImageUrl) : null;
    const fileTypes = IMAGE_FIELD_FILE_TYPES;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    const {imageSizeNotOkayFunc, imageSizeNotOkayMsgFunc} = this.props;
    const imageSizeValidationEnabled = typeof imageSizeNotOkayFunc === 'function';
    const imageSizeNotOkay = imageSizeValidationEnabled ? imageSizeNotOkayFunc(imageWidth, imageHeight) : false;
    const imageSizeNotOkayMsg = imageSizeValidationEnabled && imageSizeNotOkayMsgFunc ?
      imageSizeNotOkayMsgFunc(imageWidth, imageHeight) : '';
    return (<div className="lh-upload-wrapper">
      <FileUploader
        handleChange={this.onFileUpload}
        name="imageUploader"
        types={fileTypes}
        disabled={uploading}
        classes="lh-upload-fileinput"
      >
        <div className="lh-upload-image-size lh-upload-box">
          {absoluteImageUrl ? <PreviewImage url={absoluteImageUrl}/> :
            <EmptyImage fileTypes={fileTypes} />}
        </div>
      </FileUploader>
      {absoluteImageUrl && <div className="text-sm flex justify-center mt-1">
        <ExternalLink linkClass="text-helper-color text-xs" text="preview image" url={absoluteImageUrl} />
      </div>}
      <div className="flex justify-center mt-2">
        <MediaLibraryPicker
          buttonLabel="Or choose from uploaded"
          buttonClass="text-helper-color text-xs underline"
          onSelect={(internalUrl, absoluteUrl, media) => {
            if (media && !isImageFieldCompatibleStoredMedia(media)) {
              showToast('That file must already be AVIF, SVG, or animated before reuse.', 'warning', 4000);
              return;
            }
            // Reuse an existing image: hand the internal (host-stripped) url to
            // the parent, exactly as a fresh upload would.
            this.setState({currentImageUrl: internalUrl});
            this.props.onImageUploaded(internalUrl, (media && media.content_type) || '');
          }}
        />
      </div>
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
        {imageSizeValidationEnabled && imageWidth > 0 && imageHeight > 0 && <div className={clsx("mt-2 text-xs text-center", imageSizeNotOkay ? 'text-red-500' : 'text-green-500')}>
          {imageSizeNotOkay ? <div>{imageSizeNotOkayMsg}</div> :
            <div>Image ok: {parseInt(imageWidth)} x {parseInt(imageHeight)} pixels.</div>}
        </div>}
      </AdminDialog>
    </div>);
  }
}
