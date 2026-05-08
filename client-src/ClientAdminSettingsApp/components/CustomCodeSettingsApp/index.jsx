import React from 'react';
import {ADMIN_URLS} from "../../../../common-src/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES, CODE_TYPES} from "../../../../common-src/Constants";
import {isChineseLanguage} from "../../../../common-src/I18n";

function NavBlock({url, text}) {
  return (<div>
    <a href={url}>
      {text} <span className="lh-icon-arrow-right"/>
    </a>
  </div>);
}

export default class CustomCodeSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentType: SETTINGS_CATEGORIES.CUSTOM_CODE,
    };
  }

  render() {
    const {submitting, submitForType, feed} = this.props;
    const {currentType} = this.state;
    const isZh = isChineseLanguage(feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;

    return (<SettingsBase
      title={t('自定义代码', 'Custom code')}
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
      <NavBlock
        url={ADMIN_URLS.codeEditorSettings()}
        text={t('编辑网页共用的 HTML 代码', 'Edit shared HTML code')}
      />
      <div className="text-xs text-muted-color mt-2">
        {t('用于配置 <head></head> 内，以及 <body></body> 顶部和底部的代码。', 'Used for configuring code inside <head></head>, and at the top and bottom of <body></body>.')}
      </div>

      <div className="mt-8">
        <div className="lh-page-subtitle">{t('主题模板', 'Theme templates')}</div>
        <NavBlock
          url={`${ADMIN_URLS.codeEditorSettings()}?type=${CODE_TYPES.THEMES}&theme=custom`}
          text={t('编辑网页与 RSS 的模板', 'Edit web and RSS templates')}
        />
        <div className="text-xs text-muted-color mt-2">
          <em>{t('microfeed 后续会支持更多主题 / 模板。', 'microfeed will support more themes / templates later.')}</em>
        </div>
      </div>
    </SettingsBase>);
  }
}
