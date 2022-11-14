import React from 'react';
// import {FileUploader} from "react-drag-drop-files";
import Requests from '../../../../../common/requests';
import {randomHex} from '../../../../../../common-src/StringUtils';
// import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import {ENCLOSURE_CATEGORIES, ENCLOSURE_CATEGORIES_DICT} from "../../../../../../common-src/Constants";
import AdminRadio from "../../../../../components/AdminRadio";
import AdminInput from "../../../../../components/AdminInput";

const UPLOAD_STATUS__START = 1;

const SUPPORTED_ENCLOSURE_CATEGORIES = [
  ENCLOSURE_CATEGORIES.AUDIO,
  ENCLOSURE_CATEGORIES.DOCUMENT,
  ENCLOSURE_CATEGORIES.EXTERNAL_URL,
];

function MediaUploader({category}) {
  return (<div>
    {category} uploader
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

export default class EnclosureManager extends React.Component {
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

  componentDidMount() {
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
    // console.log(cdnFilename, size, type);
    Requests.upload(file, cdnFilename, (percentage) => {
      this.setState({progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl, arrayBuffer) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.decodeAudioData(arrayBuffer, (buffer) => {
        const duration = parseInt(buffer.duration, 10); // in seconds
        this.setState({
          progressText: null,
          uploadStatus: null,

          url: cdnUrl,
          durationSecond: duration,
          contentType: type,
          sizeByte: size,
        }, () => {
          this.props.onMediaFileUpdated({
            url: cdnUrl,
            durationSecond: duration,
            sizeByte: size,
            contentType: type,
            category,
          });
          if (this.audioRef) {
            this.audioRef.pause();
            this.audioRef.load();
          }
        });
      });
    });
  }

  render() {
    // const fileTypes = ['MP3'];
    const {
      category, url,
      // uploadStatus, progressText, audio, audioFileType, audioFileSizeByte,
    } = this.state;
    // const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      <h2 className="lh-page-title">
        Media File
      </h2>
      <div className="flex">
        <AdminRadio
          groupName="category"
          buttons={SUPPORTED_ENCLOSURE_CATEGORIES.map((cat) => ({
            name: ENCLOSURE_CATEGORIES_DICT[cat].name,
            value: cat,
            checked: cat === category,
          }))}
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
        />}
      </div>
    </div>);
  }
}
