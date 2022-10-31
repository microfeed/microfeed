import React from 'react';
import { FileUploader } from "react-drag-drop-files";
import Requests from '../../../../../common/requests';
import {randomHex} from '../../../../../../common-src/StringUtils';

const UPLOAD_STATUS__START = 1;

export default class AudioUploaderApp extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUpload = this.onFileUpload.bind(this);

    this.state = {
      previousAudioUrl: null,
      currentAudioUrl: props.currentAudioUrl || null,

      uploadStatus: null,
      progressText: null,
    };
  }

  componentDidMount() {
  }

  onFileUpload(file) {
    this.setState({ uploadStatus: UPLOAD_STATUS__START });
    const {name} = file;
    const extension = name.slice((name.lastIndexOf(".") - 1 >>> 0) + 2);
    let newFilename = `audio-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    // const previewUrl = URL.createObjectURL(file);
    // this.setState({currentAudioUrl: previewUrl});
    const cdnFilename = `media/${newFilename}`;
    Requests.upload(file, cdnFilename, (percentage) => {
      this.setState({progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl) => {
      // this.props.onImageUploaded(cdnUrl);
      console.log(cdnUrl);
      this.setState({progressText: null, uploadStatus: null});
    });
  }

  render() {
    const fileTypes = ['PNG', 'JPG'];
    const {uploadStatus, progressText} = this.state;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      <h2 className="lh-page-title">
        Audio
      </h2>
      <div className="">
         <FileUploader
           handleChange={this.onFileUpload}
           name="audioUploader"
           types={fileTypes}
           disabled={uploading}
         >
           <div className="w-full p-4 text-center border-dashed border-2 border-brand-light">
             {uploading ? <div className="">
               {progressText}
             </div> : <div className="text-brand-light">
               Drag and drop here
             </div>}
           </div>
         </FileUploader>
      </div>
    </div>);
  }
}
