import React from 'react';
import Requests from '../../../../../common/requests';
import {humanFileSize, randomHex, secondsToHHMMSS} from '../../../../../../common-src/StringUtils';
import {ENCLOSURE_CATEGORIES, ENCLOSURE_CATEGORIES_DICT} from "../../../../../../common-src/Constants";
import AdminRadio from "../../../../../components/AdminRadio";
import AdminInput from "../../../../../components/AdminInput";
import {FileUploader} from "react-drag-drop-files";
import {CloudArrowUpIcon} from "@heroicons/react/24/outline";

const UPLOAD_STATUS__START = 1;

const SUPPORTED_ENCLOSURE_CATEGORIES = [
  ENCLOSURE_CATEGORIES.AUDIO,
  ENCLOSURE_CATEGORIES.VIDEO,
  ENCLOSURE_CATEGORIES.DOCUMENT,
  ENCLOSURE_CATEGORIES.EXTERNAL_URL,
];

function PreviewCurrentMediaFile({url, contentType, category, durationSecond, sizeByte, setRef, updateDuration}) {
  return (<div className="mb-8">
      <div className="lh-page-subtitle">Current {category}</div>
      <div className="grid grid-cols-2 gap-4">
        {category === ENCLOSURE_CATEGORIES.AUDIO && <div className="col-span-1">
          <audio controls preload="metadata" ref={setRef} onLoadedMetadata={updateDuration}>
            <source src={url} type={contentType}/>
            Your browser does not support the audio element.
          </audio>
        </div>}
        {category === ENCLOSURE_CATEGORIES.VIDEO && <div className="col-span-1">
          <video width="80%" preload="metadata" controls ref={setRef} onLoadedMetadata={updateDuration}>
            <source src={url} type={contentType} />
            Your browser does not support the video tag.
          </video>
        </div>}
        <div className="col-span-1 text-sm">
          <div className="mb-1">
            <span className="text-helper-color">Content type:</span> {contentType}
          </div>
          <div className="mb-1">
            <span className="text-helper-color">File size:</span> {humanFileSize(sizeByte)}
          </div>
          {[ENCLOSURE_CATEGORIES.AUDIO, ENCLOSURE_CATEGORIES.VIDEO].includes(category) && <div className="mb-1">
            <span className="text-helper-color">Duration:</span> {secondsToHHMMSS(durationSecond)}
          </div>}
          <div className="break-all">
            <span className="text-helper-color">Download url:</span> <a href={url} className="text-xs" target="_blank">{url}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaUploader(
  {url, category, contentType, sizeByte, durationSecond, setRef, uploading, progressText, onFileUpload, updateDuration}) {
  const {fileTypes} = ENCLOSURE_CATEGORIES_DICT[category];
  return (<div>
    {url && <PreviewCurrentMediaFile
      url={url}
      category={category}
      contentType={contentType}
      sizeByte={sizeByte}
      durationSecond={durationSecond}
      setRef={setRef}
      updateDuration={updateDuration}
    />}
    {url && <div className="border-t pt-2 mb-2"/>}
    <div className="lh-upload-wrapper">
      <div className="lh-page-subtitle">Upload a new {category} file</div>
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
              <div className="font-semibold">Click or drag here to upload {category}</div>
            </div>
            <div className="text-sm">{fileTypes.join(',')}</div>
          </div>}
        </div>
      </FileUploader>
    </div>
  </div>);
}

function UrlEditor({url, onUpdateUrl}) {
  return (<div>
    <AdminInput
      placeholder="e.g., https://www.nytimes.com/2022/11/13/us/politics/senate-democrats-republicans.html"
      customClass="text-xs"
      type="url"
      value={url}
      onChange={(e) => onUpdateUrl(e.target.value)}
    />
  </div>);
}

export default class MediaManager extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUpload = this.onFileUpload.bind(this);
    this.setState = this.setState.bind(this);

    const {mediaFile} = props;
    let {url, category, contentType, sizeByte, durationSecond} = mediaFile || {};

    const urlParams = new URLSearchParams(window.location.search);
    if (!category) {
      category = urlParams.get('media_category');
      if (!SUPPORTED_ENCLOSURE_CATEGORIES.includes(category)) {
        category = null;
      }
    }

    if (!url) {
      url = urlParams.get('media_url') || '';
    }

    this.initState = {
      url: '',
      contentType: null,
      sizeByte: 0,
      durationSecond: 0,
    };

    this.state = {
      url,
      category: category || ENCLOSURE_CATEGORIES.AUDIO,
      contentType,
      sizeByte,
      durationSecond: durationSecond || 0,

      uploadStatus: null,
      progressText: '0.00%',
    };
  }

  onFileUpload(file) {
    const {category} = this.state;
    this.setState({uploadStatus: UPLOAD_STATUS__START});
    const {name, size, type} = file;
    const extension = name.slice((name.lastIndexOf('.') - 1 >>> 0) + 2);
    let newFilename = `${category}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    const cdnFilename = `media/${newFilename}`;

    const updateState = (cdnUrl) => {
      this.setState({
        progressText: null,
        uploadStatus: null,

        url: cdnUrl,
        contentType: type,
        sizeByte: size,
      }, () => {
        this.props.onMediaFileUpdated({
          url: cdnUrl,
          sizeByte: size,
          contentType: type,
          category,
        });
        if (this.audioRef && category === ENCLOSURE_CATEGORIES.AUDIO) {
          this.audioRef.pause();
          this.audioRef.load();
        } else if (this.videoRef && category === ENCLOSURE_CATEGORIES.VIDEO) {
          this.videoRef.pause();
          this.videoRef.load();
        }
      });
    };

    Requests.upload(file, cdnFilename, (percentage) => {
      this.setState({progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl) => {
        updateState(cdnUrl, 0);
    });
  }

  render() {
    const {
      category, url, contentType, sizeByte, durationSecond,
      uploadStatus, progressText,
    } = this.state;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      <h2 className="lh-page-title">
        Media file
      </h2>
      <div className="flex">
        <AdminRadio
          groupName="category"
          customLabelClass="font-semibold"
          buttons={SUPPORTED_ENCLOSURE_CATEGORIES.map((cat) => ({
            name: ENCLOSURE_CATEGORIES_DICT[cat].name,
            value: cat,
            checked: cat === category,
          }))}
          disabled={uploading}
          onChange={(e) => {
            if (url) {
              const {name} = ENCLOSURE_CATEGORIES_DICT[category];
              const newName = ENCLOSURE_CATEGORIES_DICT[e.target.value].name;
              const ok = confirm(`To switch to ${newName}, you should discard ${name} first. This will delete existing ${name}. Do you want to proceed?`);
              if (!ok) {
                return;
              }
            }
            this.setState({category: e.target.value, ...this.initState});
          }}
        />
      </div>
      <div className="mt-4">
        {[ENCLOSURE_CATEGORIES.EXTERNAL_URL].includes(category) ? <UrlEditor
          url={url}
          onUpdateUrl={(newUrl) => {
            this.setState(prevState => ({
              ...prevState,
              url: newUrl,
              contentType: 'text/html',  // TODO: dynamically fetch content type by sending HEAD request
            }), () => {
              this.props.onMediaFileUpdated({
                url: this.state.url,
                durationSecond: this.state.durationSecond,
                sizeByte: this.state.sizeByte,
                contentType: this.state.contentType,
                category: this.state.category,
              });
            })
          }}
        /> : <MediaUploader
          url={url}
          category={category}
          contentType={contentType}
          sizeByte={sizeByte}
          durationSecond={durationSecond}
          updateDuration={(e) => {
            try {
              const newDurationSecond = parseInt(e.target.duration, 10);
              if (newDurationSecond > 0) {
                this.setState({
                  durationSecond: newDurationSecond,
                }, () => {
                  this.props.onMediaFileUpdated({
                    durationSecond: newDurationSecond,
                  });
                });
              }
            } catch (e) { // eslint-disable-line
            }
          }}
          setRef={(ref) => {
            if (category === ENCLOSURE_CATEGORIES.AUDIO) {
              this.audioRef = ref;
            } else if (category ===  ENCLOSURE_CATEGORIES.VIDEO) {
              this.videoRef = ref;
            }
          }}
          uploading={uploading}
          progressText={progressText}
          onFileUpload={this.onFileUpload}
        />}
      </div>
    </div>);
  }
}
