import React from 'react';
import {FileUploader} from "react-drag-drop-files";
import Requests from '../../../../../common/requests';
import {randomHex, humanFileSize} from '../../../../../../common-src/StringUtils';

const UPLOAD_STATUS__START = 1;

function PreviewCurrentAudio({audio, audioFileType, audioFileSizeByte}) {
  return (<div className="mb-8">
      <h3 className="lh-page-subtitle">Current audio</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-1">
          <audio controls preload="metadata">
            <source src={audio} type={audioFileType}/>
            Your browser does not support the audio element.
          </audio>
        </div>
        <div className="col-span-1 text-sm grid grid-cols-1 gap-1">
          <div>
            File format: <b>{audioFileType}</b>
          </div>
          <div>
            File size: <b>{humanFileSize(audioFileSizeByte)}</b>
          </div>
          <div className="break-all">
            Audio url: <a href={audio} className="text-xs" target="_blank">{audio}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default class AudioUploaderApp extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUpload = this.onFileUpload.bind(this);

    this.state = {
      audio: props.audio || null,
      audioDurationSecond: props.audioDurationSecond || 0,
      audioFileType: props.audioFileType || '',
      audioFileSizeByte: props.audioFileSizeByte || 0,

      uploadStatus: null,
      progressText: null,
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
        });
      });
    });
  }

  render() {
    const fileTypes = ['MP3', 'M4A'];
    const {uploadStatus, progressText, audio, audioFileType, audioFileSizeByte} = this.state;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      <h2 className="lh-page-title">
        Audio
      </h2>
      {audio && <PreviewCurrentAudio
        audio={audio}
        audioFileType={audioFileType}
        audioFileSizeByte={audioFileSizeByte}
      />}
      {audio && <div className="border-t pt-2 mb-2" />}
      <div className="">
        <h3 className="lh-page-subtitle">Upload a new audio file</h3>
        <FileUploader
          handleChange={this.onFileUpload}
          name="audioUploader"
          types={fileTypes}
          disabled={uploading}
        >
          <div className="w-full p-4 text-center border-dashed border-2 border-brand-light hover:cursor-pointer">
            {uploading ? <div className="">
              {progressText}
            </div> : <div className="text-brand-light">
              <div className="font-semibold">Click to upload or Drag and drop</div>
              <div className="text-sm">{fileTypes.join(',')}</div>
            </div>}
          </div>
        </FileUploader>
      </div>
    </div>);
  }
}
