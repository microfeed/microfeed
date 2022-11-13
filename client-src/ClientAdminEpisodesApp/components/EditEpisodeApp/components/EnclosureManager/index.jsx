import React from 'react';
// import {FileUploader} from "react-drag-drop-files";
import Requests from '../../../../../common/requests';
import {randomHex} from '../../../../../../common-src/StringUtils';
// import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import {ENCLOSURE_CATEGORIES, ENCLOSURE_CATEGORIES_DICT} from "../../../../../../common-src/Constants";
import AdminRadio from "../../../../../components/AdminRadio";

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

function UrlEditor() {
  return (<div>
    url editor
  </div>);
}

export default class EnclosureManager extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUpload = this.onFileUpload.bind(this);

    const {enclosure} = props;
    let {url, category, contentType, sizeByte} = enclosure || {};

    this.state = {
      audio: props.audio || null,
      audioDurationSecond: props.audioDurationSecond || 0,
      audioFileType: props.audioFileType || '',
      audioFileSizeByte: props.audioFileSizeByte || 0,

      url,
      category: category || ENCLOSURE_CATEGORIES.AUDIO,
      contentType,
      sizeByte,

      uploadStatus: null,
      progressText: '0.00%',
    };
  }

  componentDidMount() {
  }

  onFileUpload(file) {
    this.setState({uploadStatus: UPLOAD_STATUS__START});
    const {name, size, type} = file;
    const extension = name.slice((name.lastIndexOf('.') - 1 >>> 0) + 2);
    let newFilename = `audio-${randomHex(32)}`;
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
          audio: cdnUrl,
          audioDurationSecond: duration,
          audioFileType: type,
          audioFileSizeByte: size,
        }, () => {
          this.props.onUploaded(cdnUrl, duration, size, type);
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
      category,
      // uploadStatus, progressText, audio, audioFileType, audioFileSizeByte,
    } = this.state;
    // const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      <h2 className="lh-page-title">
        Main Multimedia File
      </h2>
      <div className="flex">
        <AdminRadio
          groupName="category"
          buttons={SUPPORTED_ENCLOSURE_CATEGORIES.map((cat) => ({
            name: ENCLOSURE_CATEGORIES_DICT[cat].name,
            value: cat,
            checked: cat === category,
          }))}
          onChange={(e) => this.setState({category: e.target.value})}
        />
      </div>
      <div>
        {[ENCLOSURE_CATEGORIES.EXTERNAL_URL].includes(category) ?
          <UrlEditor /> :
          <MediaUploader category={category} />}
      </div>
    </div>);
  }
}
