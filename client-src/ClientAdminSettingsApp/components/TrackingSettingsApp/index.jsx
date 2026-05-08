import React from 'react';
import AdminTextarea from "../../../components/AdminTextarea";
import {buildAudioUrlWithTracking} from "../../../../common-src/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";
import {isChineseLanguage} from "../../../../common-src/I18n";

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
    const isZh = isChineseLanguage(this.props.feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;
    const urls = trackingUrls.trim() !== '' ? trackingUrls.trim().split(/\n/) : [];
    const exampleAudio = 'https://example.com/audio.mp3';
    return (<SettingsBase
      title={t('追踪链接', 'Tracking urls')}
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
          placeholder={t('每行填写一个追踪链接，例如：https://op3.dev/e/、https://pdst.fm/e/、https://chrt.fm/track/...', 'Put a tracking url on each line, e.g., https://op3.dev/e/, https://pdst.fm/e/, https://chrt.fm/track/...')}
          value={trackingUrls}
          onChange={(e) => this.setState({trackingUrls: e.target.value}, () => setChanged())}
        />
      </div>
      <div className="mt-4 text-xs text-helper-color">
        {t('microfeed 会自动把第三方追踪链接（例如 ', 'microfeed will automatically add 3rd-party tracking urls (e.g., ')}<a href="https://op3.dev/">OP3</a>{t('、', ', ')}<a
        href="http://analytics.podtrac.com/">Podtrac</a>{t('）加到媒体文件 URL 前面，方便你统计下载数据。这是播客行业里很常见的做法。', '...) before the url of a media file, so you can easily track download stats. This is a common practice in the podcast industry.')}
      </div>
      {urls.length > 0 && <div className="mt-4 text-xs break-all text-helper-color">
        <div className="mb-2">
          {t(`示例：如果音频地址是 ${exampleAudio}，那么 RSS feed 中最终生成的地址会是：`, `Example: if an audio url is ${exampleAudio}, then the final url in the rss feed will be:`)}
        </div>
        <b>{buildAudioUrlWithTracking(exampleAudio, urls)}</b>
      </div>}
    </SettingsBase>);
  }
}
