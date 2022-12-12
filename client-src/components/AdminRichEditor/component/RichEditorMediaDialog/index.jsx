import React from "react";
import {Quill} from "react-quill";
import {FileUploader} from "react-drag-drop-files";
import AdminDialog from "../../../AdminDialog";
import AdminRadio from "../../../AdminRadio";
import AdminInput from "../../../AdminInput";
import {CloudArrowUpIcon} from "@heroicons/react/24/outline";
import {ENCLOSURE_CATEGORIES_DICT, ENCLOSURE_CATEGORIES} from "../../../../../common-src/Constants";
import {randomHex, urlJoinWithRelative} from "../../../../../common-src/StringUtils";
import Requests from "../../../../common/requests";

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
    const {name} = file;
    const extension = name.slice((name.lastIndexOf('.') - 1 >>> 0) + 2);
    let newFilename = `${mediaType}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    const extra = this.props.extra || {};
    const publicBucketUrl = extra.publicBucketUrl || '';
    const folderName = extra.folderName || 'unknown';
    const cdnFilename = `media/rich-editor/${folderName}/${newFilename}`;

    Requests.upload(file, cdnFilename, (percentage) => {
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
    });
  }

  insertMedia() {
    const {quill, quillSelection, mediaType} = this.props;
    if (!quill) {
      return;
    }
    const {url} = this.state;
    if (url) {
      const index = quillSelection ? quillSelection.index : 0;
      quill.insertEmbed(index, mediaType, url, Quill.sources.USER);
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
            buttons={[
              {
                'name': 'Upload a new file',
                'value': 'upload',
                'checked': mode === 'upload',
              },
              {
                'name': 'From URL',
                'value': 'url',
                'checked': mode === 'url',
              },
            ]}
            onChange={(e) => {
              this.setState({mode: e.target.value});
            }}
            disabled={false}
          />
        </div>
        <div>
          {mode === 'upload' ?
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
