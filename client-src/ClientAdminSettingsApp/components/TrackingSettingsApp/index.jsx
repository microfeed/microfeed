import React from 'react';
import AdminTextarea from "../../../components/AdminTextarea";
import {buildAudioUrlWithTracking} from "../../../../common-src/StringUtils";

export default class TrackingSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.onChange = this.onChange.bind(this);
    const {feed} = props;
    let trackingUrls = '';
    if (feed.settings && feed.settings.analytics) {
      trackingUrls = feed.settings.analytics.urls || [];
      trackingUrls = trackingUrls.join('\n');
    }
    this.state = {
      trackingUrls,
      currentType: 'analytics',
    }
  }

  onChange(e) {
    this.setState({trackingUrls: e.target.value})
  }

  render() {
    const {trackingUrls, currentType} = this.state;
    const {submitting, submitForType} = this.state;
    const submittingForThis = submitForType === currentType;
    const urls = trackingUrls.trim() !== '' ? trackingUrls.trim().split(/\n/) : [];
    const exampleAudio = 'https://example.com/audio.mp3';
    return (<form className="lh-page-card">
      <h2 className="lh-page-title">
        <div className="flex">
          <div className="flex-1">Tracking urls</div>
          <div className="flex-none">
            <button
              disabled={submittingForThis || submitting}
              className="lh-btn lh-btn-brand-dark"
              onClick={(e) => {
                this.props.onSubmit(e, currentType, {
                  urls,
                });
              }}
            >{submittingForThis ? 'Updating...' : 'Update'}</button>
          </div>
        </div>
      </h2>
      <div>
        <AdminTextarea
          placeholder="Put a tracking url on each line, e.g., https://pdst.fm/e/"
          value={trackingUrls}
          onChange={this.onChange}
        />
      </div>
      {urls.length > 0 && <div className="mt-4 text-xs break-all">
        Example: if an audio url is {exampleAudio}, then the final url in the rss feed will be <b>
          {buildAudioUrlWithTracking(exampleAudio, urls)}</b>
      </div>}
    </form>);
  }
}
