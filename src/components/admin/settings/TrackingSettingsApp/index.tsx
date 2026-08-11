import React from 'react';
import AdminTextarea from "@/components/admin/shared/AdminTextarea";
import {Button} from "@/components/ui/button";
import {buildAudioUrlWithTracking} from "@/shared/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

export default class TrackingSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    const currentType = SETTINGS_CATEGORIES.ANALYTICS;
    const {feed} = props;
    let trackingUrls = '';
    if (feed.settings && feed.settings[currentType]) {
      trackingUrls = feed.settings[currentType].urls || [];
      trackingUrls = (trackingUrls as any).join('\n');
    }
    this.state = {
      trackingUrls,
      savedTrackingUrls: trackingUrls,
      currentType,
    };
  }

  render() {
    const {trackingUrls, savedTrackingUrls, currentType} = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    const urls = trackingUrls.trim() !== '' ? trackingUrls.trim().split(/\n/) : [];
    const changed = trackingUrls !== savedTrackingUrls;
    const submittingForThis = submitForType === currentType;
    const exampleAudio = 'https://example.com/audio.mp3';
    return (<SettingsBase
      title="Tracking urls"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
      <div>
        <AdminTextarea
          placeholder="Put a tracking url on each line, e.g., https://op3.dev/e/ or https://pdst.fm/e/"
          value={trackingUrls}
          onChange={(e: any) => this.setState({trackingUrls: e.target.value}, () => setChanged())}
        />
      </div>
      <div className="mt-4 text-xs text-helper-color">
        microfeed will automatically add 3rd-party tracking urls (e.g., <a href="https://op3.dev/">OP3</a>, <a
        href="http://analytics.podtrac.com/">Podtrac</a>...) before the url of a media file, so you can easily track download stats. This is a <a href="https://lowerstreet.co/blog/podcast-tracking" target="_blank" rel="noopener noreferrer">common practice in the podcast industry</a>.
      </div>
      {urls.length > 0 && <div className="mt-4 text-xs break-all text-helper-color">
        <div className="mb-2">
          Example: if an audio url is {exampleAudio}, then the final url in the rss feed will be:
        </div>
        <b>{buildAudioUrlWithTracking(exampleAudio, urls)}</b>
      </div>}
      {changed && <div className="mt-5 flex justify-end">
        <Button
          disabled={submittingForThis || submitting}
          type="button"
          onClick={(e: any) => {
            const submittedTrackingUrls = trackingUrls;
            void Promise.resolve(this.props.onSubmit(e, currentType, {urls}))
              .then((updated) => {
                if (updated) {
                  this.setState({savedTrackingUrls: submittedTrackingUrls});
                }
              });
          }}
        >
          {submittingForThis ? 'Updating...' : 'Update'}
        </Button>
      </div>}
    </SettingsBase>);
  }
}
