import React from 'react';
import clsx from "clsx";
import Requests from "../../../../../common/requests";
import {ADMIN_URLS} from "../../../../../../common-src/StringUtils";
import {showToast} from "../../../../../common/ToastUtils";
import {isChineseLanguage} from "../../../../../../common-src/I18n";

const SUBMIT_STATUS__START = 1;

const LANGUAGE_OPTIONS = [
  {
    code: 'zh-cn',
    title: '简体中文',
    descriptionZh: '适合中文网站，公开页面会输出 `lang="zh-cn"`。',
    descriptionEn: 'Best for Chinese websites. Public pages will output `lang="zh-cn"`.',
    successText: '更新成功！',
    networkErrorText: '网络错误，请刷新页面后重试。',
    failedText: '更新失败，请重试。',
  },
  {
    code: 'en-us',
    title: 'English',
    descriptionZh: '适合英文网站，公开页面会输出 `lang="en-us"`。',
    descriptionEn: 'Best for English websites. Public pages will output `lang="en-us"`.',
    successText: 'Updated!',
    networkErrorText: 'Network error. Please refresh the page and try again.',
    failedText: 'Update failed. Please try again.',
  },
];

const LANGUAGE_OPTIONS_DICT = Object.assign({}, ...LANGUAGE_OPTIONS.map((option) => ({[option.code]: option})));

function getCurrentLanguageLabel(language) {
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language);
  if (current) {
    return `${current.title} (${current.code})`;
  }
  return language || 'en-us';
}

export default class LanguageSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      submitStatus: null,
      currentLanguage: props.feed.channel.language || 'en-us',
    };
  }

  updateLanguage(language) {
    const {feed, onUpdated} = this.props;
    const targetOption = LANGUAGE_OPTIONS_DICT[language] || LANGUAGE_OPTIONS_DICT['en-us'];
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
      channel: {
        ...feed.channel,
        language,
      },
    }).then(() => {
      this.setState({submitStatus: null, currentLanguage: language}, () => {
        showToast(targetOption.successText, 'success');
        if (onUpdated) {
          onUpdated(language);
        }
        setTimeout(() => {
          location.reload();
        }, 300);
      });
    }).catch((error) => {
      this.setState({submitStatus: null});
      if (!error.response) {
        showToast(targetOption.networkErrorText, 'error');
      } else {
        showToast(targetOption.failedText, 'error');
      }
    });
  }

  render() {
    const {currentLanguage, submitStatus} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const isZh = isChineseLanguage(currentLanguage);
    const t = (zhText, enText) => isZh ? zhText : enText;

    return (<div className="lh-page-card">
      <div className="lh-page-title">{t('网页语言', 'Website language')}</div>
      <div className="text-sm text-helper-color mt-4">
        {t('当前语言：', 'Current language: ')}
        <span className="font-semibold text-black">{getCurrentLanguageLabel(currentLanguage)}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 mt-4">
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = option.code === currentLanguage;
          return (<button
            key={option.code}
            type="button"
            disabled={submitting || selected}
            className={clsx(
              'border rounded-sm p-3 text-left hover:border-brand-light',
              selected ? 'border-brand-light bg-slate-50' : 'border-slate-300',
              (submitting || selected) ? 'cursor-not-allowed opacity-80' : '',
            )}
            onClick={() => this.updateLanguage(option.code)}
          >
            <div className="font-semibold">
              {selected ? t(`当前使用：${option.title}`, `Current: ${option.title}`) : t(`切换为：${option.title}`, `Switch to: ${option.title}`)}
            </div>
            <div className="text-xs text-helper-color mt-1">
              {isZh ? option.descriptionZh : option.descriptionEn}
            </div>
          </button>);
        })}
      </div>
      <div className="mt-4 text-xs text-helper-color">
        {t('如果以后还需要更多语言，你仍然可以在“编辑频道”页面里直接修改语言字段。', 'If you need more languages later, you can still edit the language field on the "Edit channel" page.')}
      </div>
    </div>);
  }
}
