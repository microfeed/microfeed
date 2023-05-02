import React from 'react';
import AdminTextarea from "../../../components/AdminTextarea";
import {buildAudioUrlWithTracking} from "../../../../common-src/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";

export default class TrackingSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = SETTINGS_CATEGORIES.ANALYTICS;
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
          placeholder="Put a tracking url on each line, e.g., https://op3.dev/e/, https://pdst.fm/e/, https://chrt.fm/track/..."
          value={trackingUrls}
          onChange={(e) => this.setState({trackingUrls: e.target.value}, () => setChanged())}
        />
      </div>
      <div className="mt-4 text-xs text-helper-color">
        microfeed will automatically add 3rd-party tracking urls (e.g., <a href="https://op3.dev/">OP3</a>, <a
        href="http://analytics.podtrac.com/">Podtrac</a>, <a href="https://chartable.com/">Chartable</a>...) before the url of a media file, so you can easily track download stats. This is a <a href="https://lowerstreet.co/blog/podcast-tracking" target="_blank" rel="noopener noreferrer">common practice in the podcast industry</a>.
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
