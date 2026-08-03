import React from 'react';
import Requests from '@/client/requests';
import AdminNavApp from '@/components/admin/shared/AdminNavApp';
import AdminImageUploaderApp from '@/components/admin/shared/AdminImageUploaderApp';
import AdminInput from "@/components/admin/shared/AdminInput";
import AdminRadio from "@/components/admin/shared/AdminRadio";
import {
  ADMIN_URLS,
  resolvePublicBucketUrl,
} from '@/shared/StringUtils';
import {showToast} from "@/client/ToastUtils";
import {AdminSideQuickLinks} from "@/components/admin/shared/AdminSideQuickLinks";
import AdminRichEditor from "@/components/admin/shared/AdminRichEditor";
import AdminSelect from "@/components/admin/shared/AdminSelect";
import {
  ITUNES_CATEGORIES_DICT,
  LANGUAGE_CODES_LIST,
  NAV_ITEMS,
  ONBOARDING_TYPES,
} from "@/shared/Constants";
import ExplainText from "@/components/admin/shared/ExplainText";
import {CHANNEL_CONTROLS, CONTROLS_TEXTS_DICT} from "./FormExplainTexts";
import {
  preventCloseWhenChanged,
  readJsonScript,
} from "@/client/BrowserUtils";

const SUBMIT_STATUS__START = 1;

const LANGUAGE_CODES_DICT = {};
const LANGUAGE_CODES_SELECT_OPTIONS: any[] = [];
LANGUAGE_CODES_LIST.forEach((lc: any) => {
  (LANGUAGE_CODES_DICT as any)[lc.code] = {
    code: lc.code,
    value: `${lc.name} ${lc.code}`,
    label: <div>
      <div>{lc.name}</div>
      <div className="text-muted-color text-sm">{lc.code}</div>
    </div>,
  };
  LANGUAGE_CODES_SELECT_OPTIONS.push((LANGUAGE_CODES_DICT as any)[lc.code]);
});

const CATEGORIES_SELECT_OPTIONS: any[] = [];
const CATEGORIES_DICT = {};
Object.keys(ITUNES_CATEGORIES_DICT).forEach((topLevel: any) => {
  const topLevelOption = {
    value: topLevel,
    label: topLevel,
  };
  CATEGORIES_SELECT_OPTIONS.push(topLevelOption);
  (CATEGORIES_DICT as any)[topLevel] = topLevelOption;
  (ITUNES_CATEGORIES_DICT as any)[topLevel].forEach((subLevel: any) => {
    const subLevelValue = `${topLevel} / ${subLevel}`;
    const subLevelOption = {
      value: subLevelValue,
      label: subLevelValue,
    };
    CATEGORIES_SELECT_OPTIONS.push(subLevelOption);
    (CATEGORIES_DICT as any)[subLevelValue] = subLevelOption;
  });
});

export default class EditChannelApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateChannelMeta = this.onUpdateChannelMeta.bind(this);
    this.onUpdateChannelMetaToFeed = this.onUpdateChannelMetaToFeed.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = readJsonScript<any>('feed-content');
    const onboardingResult = readJsonScript('onboarding-result');

    const channel = feed.channel;
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

  onUpdateFeed(props: any, onSucceed: any) {
    this.setState((prevState: any) => ({
      feed: {
        ...prevState.feed,
        channel: {
          ...prevState.channel,
          ...props,
        },
      },
    }), () => onSucceed())
  }

  onUpdateChannelMeta(keyName: any, value: any) {
    this.setState((prevState: any) => ({
      changed: true,
      channel: {
        ...prevState.channel,
        [keyName]: value,
      },
    }));
  }

  onUpdateChannelMetaToFeed(onSucceed: any) {
    this.onUpdateFeed(this.state.channel, onSucceed);
  }

  onSubmit(e: any) {
    e.preventDefault();
    this.onUpdateChannelMetaToFeed(() => {
      const {feed} = this.state;
      this.setState({submitStatus: SUBMIT_STATUS__START});
      Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {channel: feed.channel})
        .then((response: any) => {
          console.log(response);
          this.setState({submitStatus: null, changed: false}, () => {
            showToast('Updated!', 'success');
          });
        })
        .catch((error: any) => {
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
    const mediaStorageReady = onboardingResult.result[
      ONBOARDING_TYPES.MEDIA_STORAGE
    ]?.ready !== false;
    const webGlobalSettings = feed.settings.webGlobalSettings || {};
    const publicBucketUrl = resolvePublicBucketUrl(
      webGlobalSettings.publicBucketUrl,
      window.location.hostname,
    );
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
                  mediaStorageReady={mediaStorageReady}
                  publicBucketUrl={publicBucketUrl}
                  currentImageUrl={channel.image}
                  onImageUploaded={(cdnUrl: any) => this.onUpdateChannelMeta('image', cdnUrl)}
                />
              </div>
              <div className="flex-1 ml-8 grid grid-cols-1 gap-3">
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.TITLE]}/>}
                  value={channel.title}
                  onChange={(e: any) => this.onUpdateChannelMeta('title', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.PUBLISHER]}/>}
                    value={channel.publisher}
                    onChange={(e: any) => this.onUpdateChannelMeta('publisher', e.target.value)}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.WEBSITE]}/>}
                    value={channel.link}
                    onChange={(e: any) => this.onUpdateChannelMeta('link', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AdminSelect
                    value={categories.map((c: any) => ((CATEGORIES_DICT as any)[c]))}
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.CATEGORIES]}/>}
                    options={CATEGORIES_SELECT_OPTIONS}
                    onChange={(selectedOptions: any) => {
                      this.onUpdateChannelMeta('categories', [...selectedOptions.map((o: any) => o.value)]);
                    }}
                    extraParams={{
                      isMulti: true,
                      isOptionDisabled: () => {
                        return categories.length >= 3;
                      },
                    }}
                  />
                  <AdminSelect
                    value={(LANGUAGE_CODES_DICT as any)[channel.language]}
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.LANGUAGE]}/>}
                    options={LANGUAGE_CODES_SELECT_OPTIONS}
                    onChange={(selected: any) => {
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
                onChange={(value: any) => {
                  this.onUpdateChannelMeta('description', value);
                }}
                extra={{
                  publicBucketUrl,
                  folderName: `channels/${channel.id}`,
                  mediaStorageReady,
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
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:explicit', e.target.value === 'yes')}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.COPYRIGHT]}/>}
                  value={channel.copyright}
                  onChange={(e: any) => this.onUpdateChannelMeta('copyright', e.target.value)}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_TITLE]}/>}
                  value={channel['itunes:title']}
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:title', e.target.value)}
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
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:type', e.target.value)}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_EMAIL]}/>}
                  type="email"
                  value={channel['itunes:email']}
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:email', e.target.value)}
                />
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_NEW_RSS_URL]}/>}
                  type="url"
                  value={channel['itunes:new-feed-url']}
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:new-feed-url', e.target.value)}
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
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:block', e.target.value === 'yes')}
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
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:complete', e.target.value === 'yes')}
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
