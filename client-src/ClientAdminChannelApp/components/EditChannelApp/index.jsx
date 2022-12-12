import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminImageUploaderApp from '../../../components/AdminImageUploaderApp';
import AdminInput from "../../../components/AdminInput";
import AdminRadio from "../../../components/AdminRadio";
import {getPublicBaseUrl} from "../../../common/ClientUrlUtils";
import {unescapeHtml} from '../../../../common-src/StringUtils';
import {showToast} from "../../../common/ToastUtils";
import {AdminSideQuickLinks} from "../../../components/AdminSideQuickLinks";
import AdminRichEditor from "../../../components/AdminRichEditor";
import AdminSelect from "../../../components/AdminSelect";
import {LANGUAGE_CODES_LIST, ITUNES_CATEGORIES_DICT, NAV_ITEMS} from "../../../../common-src/Constants";
import ExplainText from "../../../components/ExplainText";
import {CHANNEL_CONTROLS, CONTROLS_TEXTS_DICT} from "./FormExplainTexts";
import {preventCloseWhenChanged} from "../../../common/BrowserUtils";

const SUBMIT_STATUS__START = 1;

const LANGUAGE_CODES_DICT = {};
const LANGUAGE_CODES_SELECT_OPTIONS = [];
LANGUAGE_CODES_LIST.forEach((lc) => {
  LANGUAGE_CODES_DICT[lc.code] = {
    code: lc.code,
    value: `${lc.name} ${lc.code}`,
    label: <div>
      <div>{lc.name}</div>
      <div className="text-muted-color text-sm">{lc.code}</div>
    </div>,
  };
  LANGUAGE_CODES_SELECT_OPTIONS.push(LANGUAGE_CODES_DICT[lc.code]);
});

const CATEGORIES_SELECT_OPTIONS = [];
const CATEGORIES_DICT = {};
Object.keys(ITUNES_CATEGORIES_DICT).forEach((topLevel) => {
  const topLevelOption = {
    value: topLevel,
    label: topLevel,
  };
  CATEGORIES_SELECT_OPTIONS.push(topLevelOption);
  CATEGORIES_DICT[topLevel] = topLevelOption;
  ITUNES_CATEGORIES_DICT[topLevel].forEach((subLevel) => {
    const subLevelValue = `${topLevel} / ${subLevel}`;
    const subLevelOption = {
      value: subLevelValue,
      label: subLevelValue,
    };
    CATEGORIES_SELECT_OPTIONS.push(subLevelOption)
    CATEGORIES_DICT[subLevelValue] = subLevelOption;
  });
});

function initChannel() {
  return {
    link: getPublicBaseUrl(),
    language: 'en-us',
    categories: [],
    'itunes:explicit': false,
    'itunes:type': 'episodic',
    'itunes:complete': false,
    'itunes:block': false,
    'copyright': `©${(new Date()).getFullYear()}`,
  };
}

export default class EditChannelApp extends React.Component {
  constructor(props) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateChannelMeta = this.onUpdateChannelMeta.bind(this);
    this.onUpdateChannelMetaToFeed = this.onUpdateChannelMetaToFeed.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const onboardingResult = JSON.parse(unescapeHtml(document.getElementById('onboarding-result').innerHTML));

    const channel = feed.channel || initChannel();
    this.state = {
      feed,
      onboardingResult,
      channel,
      submitStatus: null,
      changed: false,
    }
  }

  componentDidMount() {
    preventCloseWhenChanged(() => this.state.changed);
  }

  onUpdateFeed(props, onSucceed) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        channel: {
          ...prevState.channel,
          ...props,
        },
      },
    }), () => onSucceed())
  }

  onUpdateChannelMeta(keyName, value) {
    this.setState((prevState) => ({
      changed: true,
      channel: {
        ...prevState.channel,
        [keyName]: value,
      },
    }));
  }

  onUpdateChannelMetaToFeed(onSucceed) {
    this.onUpdateFeed(this.state.channel, onSucceed);
  }

  onSubmit(e) {
    e.preventDefault();
    this.onUpdateChannelMetaToFeed(() => {
      const {feed} = this.state;
      this.setState({submitStatus: SUBMIT_STATUS__START});
      Requests.axiosPost('/admin/ajax/feed/', {channel: feed.channel})
        .then((response) => {
          console.log(response);
          this.setState({submitStatus: null, changed: false}, () => {
            showToast('Updated!', 'success');
          });
        })
        .catch((error) => {
          this.setState({submitStatus: null}, () => {
            if (!error.response) {
              showToast('Network error. Please refresh the page and try again.', 'error');
            } else {
              showToast('Failed. Please try again.', 'error');
            }
          });
        });
    });
  }

  render() {
    const {submitStatus, channel, feed, onboardingResult, changed} = this.state;
    const categories = channel.categories || [];
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const webGlobalSettings = feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';
    return (<AdminNavApp currentPage={NAV_ITEMS.EDIT_CHANNEL} onboardingResult={onboardingResult}>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 grid grid-cols-1 gap-4">
          <div className="lh-page-card">
            <div className="flex">
              <div className="flex-none">
                <ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.IMAGE]}/>
                <AdminImageUploaderApp
                  mediaType="channel"
                  feed={feed}
                  currentImageUrl={channel.image}
                  onImageUploaded={(cdnUrl) => this.onUpdateChannelMeta('image', cdnUrl)}
                />
              </div>
              <div className="flex-1 ml-8 grid grid-cols-1 gap-3">
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.TITLE]}/>}
                  value={channel.title}
                  onChange={(e) => this.onUpdateChannelMeta('title', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.PUBLISHER]}/>}
                    value={channel.publisher}
                    onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.WEBSITE]}/>}
                    value={channel.link}
                    onChange={(e) => this.onUpdateChannelMeta('link', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AdminSelect
                    value={categories.map((c) => (CATEGORIES_DICT[c]))}
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.CATEGORIES]}/>}
                    options={CATEGORIES_SELECT_OPTIONS}
                    onChange={(selectedOptions) => {
                      this.onUpdateChannelMeta('categories', [...selectedOptions.map((o) => o.value)]);
                    }}
                    extraParams={{
                      isMulti: true,
                      isOptionDisabled: () => {
                        return categories.length >= 3;
                      },
                    }}
                  />
                  <AdminSelect
                    value={LANGUAGE_CODES_DICT[channel.language]}
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.LANGUAGE]}/>}
                    options={LANGUAGE_CODES_SELECT_OPTIONS}
                    onChange={(selected) => {
                      this.onUpdateChannelMeta('language', selected.code);
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <AdminRichEditor
                labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.DESCRIPTION]}/>}
                value={channel.description}
                onChange={(value) => {
                  this.onUpdateChannelMeta('description', value);
                }}
                extra={{
                  publicBucketUrl,
                  folderName: `channels/${channel.id}`,
                }}
              />
            </div>
          </div>
          <details className="lh-page-card">
            <summary className="m-page-summary">
              Podcast-specific fields
            </summary>
            <div className="mt-8 grid grid-cols-1 gap-8">
              <div className="grid grid-cols-3 gap-4">
                <AdminRadio
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_EXPLICIT]}/>}
                  groupName="lh-explicit"
                  buttons={[{
                    'name': 'yes',
                    'checked': channel['itunes:explicit'],
                  }, {
                    'name': 'no',
                    'checked': !channel['itunes:explicit'],
                  }]}
                  value={channel['itunes:explicit']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:explicit', e.target.value === 'yes')}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.COPYRIGHT]}/>}
                  value={channel.copyright}
                  onChange={(e) => this.onUpdateChannelMeta('copyright', e.target.value)}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_TITLE]}/>}
                  value={channel['itunes:title']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:title', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminRadio
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_TYPE]}/>}
                  groupName="feed-itunes-type"
                  buttons={[{
                    'name': 'episodic',
                    'checked': channel['itunes:type'] === 'episodic',
                  }, {
                    'name': 'serial',
                    'checked': channel['itunes:type'] === 'serial',
                  }]}
                  value={channel['itunes:type']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:type', e.target.value)}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_EMAIL]}/>}
                  type="email"
                  value={channel['itunes:email']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:email', e.target.value)}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_NEW_RSS_URL]}/>}
                  type="url"
                  value={channel['itunes:new-feed-url']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:new-feed-url', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminRadio
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_BLOCK]}/>}
                  groupName="feed-itunes-block"
                  buttons={[{
                    'name': 'yes',
                    'checked': channel['itunes:block'],
                  }, {
                    'name': 'no',
                    'checked': !channel['itunes:block'],
                  }]}
                  value={channel['itunes:block']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:block', e.target.value === 'yes')}
                />
                <AdminRadio
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_COMPLETE]}/>}
                  groupName="feed-itunes-complete"
                  buttons={[{
                    'name': 'yes',
                    'checked': channel['itunes:complete'],
                  }, {
                    'name': 'no',
                    'checked': !channel['itunes:complete'],
                  }]}
                  value={channel['itunes:complete']}
                  onChange={(e) => this.onUpdateChannelMeta('itunes:complete', e.target.value === 'yes')}
                />
              </div>
            </div>
          </details>
        </div>
        <div className="col-span-3">
          <div className="sticky top-8">
            <div className="text-center lh-page-card">
              <button
                type="submit"
                className="lh-btn lh-btn-brand-dark lh-btn-lg"
                onClick={this.onSubmit}
                disabled={submitting || !changed}
              >
                {submitting ? 'Updating...' : 'Update'}
              </button>
            </div>
            <AdminSideQuickLinks />
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
