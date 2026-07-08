import React from "react";
import {FileUploader} from "react-drag-drop-files";
import AdminDialog from "../../../AdminDialog";
import AdminRadio from "../../../AdminRadio";
import AdminInput from "../../../AdminInput";
import {CloudArrowUpIcon} from "@heroicons/react/24/outline";
import {ENCLOSURE_CATEGORIES_DICT, ENCLOSURE_CATEGORIES} from "../../../../../common-src/Constants";
import {randomHex, urlJoinWithRelative} from "../../../../../common-src/StringUtils";
import Requests from "../../../../common/requests";
import MediaLibrary from "../../../MediaLibrary";
import {showToast} from "../../../../common/ToastUtils";
import {classifyImageFieldFile} from "../../../../common/imageFieldUploadPipeline";

const UPLOAD_STATUS__START = 1;

function FromUrl({url, onChange, onInsert}) {
  let disabled = false;
  if (!url || url.length <= 3) {
    disabled = true;
  }
  return (<form>
    <div>
      <AdminInput
        value={url}
        type="url"
        placeholder="e.g., https://example.com/something.jpg"
        onChange={onChange}
      />
    </div>
    <div className="py-4 flex justify-center">
      <button type="submit" className="lh-btn lh-btn-brand-dark" disabled={disabled} onClick={onInsert}>
        Insert
      </button>
    </div>
  </form>);
}

function UploadNewFile({uploading, onFileUpload, mediaType, progressText}) {
  const {fileTypes} = mediaType === 'image' ? ENCLOSURE_CATEGORIES_DICT[ENCLOSURE_CATEGORIES.IMAGE] :
    ENCLOSURE_CATEGORIES_DICT[ENCLOSURE_CATEGORIES.VIDEO];
  return (<div className="lh-upload-wrapper">
    <FileUploader
      handleChange={onFileUpload}
      name="audioUploader"
      types={fileTypes}
      disabled={uploading}
      classes="lh-upload-fileinput"
    >
      <div className="w-full h-24 lh-upload-box p-4 flex items-center justify-center">
        {uploading ? <div className="text-helper-color">
          <div className="font-semibold">Uploading...</div>
          <div className="text-sm">{progressText}</div>
        </div> : <div className="text-brand-light">
          <div className="flex items-center">
            <div className="mr-1"><CloudArrowUpIcon className="w-8"/></div>
            <div className="font-semibold">Click or drag here to upload {mediaType}</div>
          </div>
          <div className="text-sm">{fileTypes.join(', ')}</div>
        </div>}
      </div>
    </FileUploader>
  </div>);
}

export default class RichEditorMediaDialog extends React.Component {
  constructor(props) {
    super(props);
    this.insertMedia = this.insertMedia.bind(this);
    this.onFileUpload = this.onFileUpload.bind(this);

    this.state = {
      url: null,
      mode: 'upload',

      uploadStatus: null,
      progressText: null,
    };
  }

  onFileUpload(file) {
    const {mediaType, setIsOpen} = this.props;
    this.setState({uploadStatus: UPLOAD_STATUS__START});
    const extra = this.props.extra || {};
    const publicBucketUrl = extra.publicBucketUrl || '';
    const isImage = mediaType === 'image';
    const classification = isImage ? classifyImageFieldFile(file) : null;
    const fallbackExtension = file.name.slice((file.name.lastIndexOf('.') - 1 >>> 0) + 2);
    const outputExtension = classification ? classification.outputExtension : fallbackExtension;
    const outputContentType = classification ? classification.outputContentType : file.type;
    const newFilename = `${mediaType}-${randomHex(32)}.${outputExtension}`;
    const cdnFilename = isImage ? `images/${newFilename}` : `media/rich-editor/${extra.folderName || 'unknown'}/${newFilename}`;
    const uploadFile = classification && classification.kind === 'raster'
      ? new File([file], newFilename, {type: outputContentType})
      : file;

    Requests.upload(uploadFile, cdnFilename, (percentage) => {
      this.setState({progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl) => {
        // updateState(cdnUrl, 0);
      const url = urlJoinWithRelative(publicBucketUrl, cdnUrl);
      this.setState({
        url,
        progressText: 'Done!',
        uploadStatus: null,
      }, () => {
        this.insertMedia();
        setIsOpen(false);
      })
    }, () => {
      this.setState({uploadStatus: null, progressText: null}, () => {
        setIsOpen(false);
        showToast('Failed. Please try again.', 'error');
      });
    }, (error) => {
      this.setState({uploadStatus: null, progressText: null}, () => {
        setIsOpen(false);
        if (!error.response) {
          showToast('Network error. Please refresh the page and try again.', 'error');
        } else {
          showToast('Failed. Please try again.', 'error');
        }
      });
    });
  }

  insertMedia() {
    const {onInsert, mediaType} = this.props;
    if (!onInsert) {
      return;
    }
    const {url} = this.state;
    if (url) {
      onInsert(url, mediaType);
      this.setState({url: null});
    }
  }

  render() {
    const {
      isOpen,
      setIsOpen,
      mediaType,
    } = this.props;
    const {mode, url, uploadStatus, progressText} = this.state;
    const disabledClose = false;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    const isImage = mediaType === 'image';
    const radioButtons = [
      {'name': 'Upload a new file', 'value': 'upload', 'checked': mode === 'upload'},
    ];
    if (isImage) {
      radioButtons.push({'name': 'Choose from uploaded', 'value': 'library', 'checked': mode === 'library'});
    }
    radioButtons.push({'name': 'From URL', 'value': 'url', 'checked': mode === 'url'});
    return (
      <AdminDialog
        title={`Insert ${mediaType}`}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        disabledClose={disabledClose}
      >
        <div className="pt-4 pb-8">
          <AdminRadio
            groupName="media-insert"
            customClass="text-sm font-semibold"
            buttons={radioButtons}
            onChange={(e) => {
              this.setState({mode: e.target.value});
            }}
            disabled={false}
          />
        </div>
        <div>
          {mode === 'library' && isImage ?
            <MediaLibrary
              selectMode
              onSelect={(absoluteUrl) => {
                // Editor content stores absolute urls, so insert the browser url.
                this.setState({url: absoluteUrl}, () => {
                  this.insertMedia();
                  setIsOpen(false);
                });
              }}
            /> :
          mode === 'upload' ?
            <UploadNewFile
              mediaType={mediaType}
              uploading={uploading}
              progressText={progressText}
              onFileUpload={this.onFileUpload}
            /> : <FromUrl
              url={url}
              onChange={(e) => this.setState({url: e.target.value})}
              onInsert={(e) => {
                e.preventDefault();
                this.insertMedia();
                setIsOpen(false);
              }}
            />}
        </div>
      </AdminDialog>
    );
  }
}
