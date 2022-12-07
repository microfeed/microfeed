import React from 'react';
import AdminTextarea from "../../../components/AdminTextarea";
import {buildAudioUrlWithTracking} from "../../../../common-src/StringUtils";
import SettingsBase from '../SettingsBase';

export default class TrackingSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = 'analytics';
    const {feed} = props;
    let trackingUrls = '';
    if (feed.settings && feed.settings[currentType]) {
      trackingUrls = feed.settings[currentType].urls || [];
      trackingUrls = trackingUrls.join('\n');
    }
    this.state = {
      trackingUrls,
      currentType,
    };
  }

  render() {
    const {trackingUrls, currentType} = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    const urls = trackingUrls.trim() !== '' ? trackingUrls.trim().split(/\n/) : [];
    const exampleAudio = 'https://example.com/audio.mp3';
    return (<SettingsBase
      title="Tracking urls"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        this.props.onSubmit(e, currentType, {
          urls,
        });
      }}
    >
      <div>
        <AdminTextarea
          placeholder="Put a tracking url on each line, e.g., https://pdst.fm/e/"
          value={trackingUrls}
          onChange={(e) => this.setState({trackingUrls: e.target.value}, () => setChanged())}
        />
      </div>
      <div className="mt-4 text-xs text-helper-color">
        microfeed will automatically adds 3rd-party tracking urls before the url of a media file, so you can easily track download stats. This is a common practice in the podcast industry.
      </div>
      {urls.length > 0 && <div className="mt-4 text-xs break-all text-helper-color">
        <div className="mb-2">
          Example: if an audio url is {exampleAudio}, then the final url in the rss feed will be:
        </div>
        <b>{buildAudioUrlWithTracking(exampleAudio, urls)}</b>
      </div>}
    </SettingsBase>);
  }
}
