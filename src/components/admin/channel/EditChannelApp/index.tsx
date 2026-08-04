import React from 'react';
import Requests from '@/client/requests';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import AdminImageUploaderApp from '@/components/admin/shared/AdminImageUploaderApp';
import AdminInput from "@/components/admin/shared/AdminInput";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
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
  ONBOARDING_TYPES,
} from "@/shared/Constants";
import ExplainText from "@/components/admin/shared/ExplainText";
import {CHANNEL_CONTROLS, CONTROLS_TEXTS_DICT} from "./FormExplainTexts";
import {
  preventCloseWhenChanged,
} from "@/client/BrowserUtils";
import type {FeedContent, OnboardingResult} from "@/types";
import {Button} from "@/components/ui/button";
import {queueReplacedImageUrl} from "@/client/ImageUploadUtils";

const SUBMIT_STATUS__START = 1;

const LANGUAGE_CODES_DICT = {};
const LANGUAGE_CODES_SELECT_OPTIONS: any[] = [];
LANGUAGE_CODES_LIST.forEach((lc: any) => {
  (LANGUAGE_CODES_DICT as any)[lc.code] = {
    code: lc.code,
    value: `${lc.name} ${lc.code}`,
    textValue: `${lc.name} ${lc.code}`,
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

interface Props {
  feedContent: FeedContent;
  onboardingResult: OnboardingResult;
}

export default class EditChannelApp extends React.Component<Props, any> {
  private cleanupNavigationGuard?: () => void;

  constructor(props: Props) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateChannelMeta = this.onUpdateChannelMeta.bind(this);
    this.onUpdateChannelMetaToFeed = this.onUpdateChannelMetaToFeed.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = props.feedContent;

    const channel = feed.channel;
    this.state = {
      feed,
      channel,
      submitStatus: null,
      changed: false,
      replacedImageUrls: [],
    }
  }

  componentDidMount() {
    this.cleanupNavigationGuard = preventCloseWhenChanged(() => this.state.changed);
  }

  componentWillUnmount() {
    this.cleanupNavigationGuard?.();
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
    if (!this.state.changed) {
      showToast('No changes to save.', 'info');
      return;
    }
    this.onUpdateChannelMetaToFeed(() => {
      const {feed, replacedImageUrls} = this.state;
      this.setState({submitStatus: SUBMIT_STATUS__START});
      Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
        channel: feed.channel,
        deleteImageUrls: replacedImageUrls,
      })
        .then((response: any) => {
          console.log(response);
          this.setState({
            submitStatus: null,
            changed: false,
            replacedImageUrls: [],
          }, () => {
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
    const {submitStatus, channel, feed} = this.state;
    const {onboardingResult} = this.props;
    const categories = channel.categories || [];
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const mediaStorage = onboardingResult.result[
      ONBOARDING_TYPES.MEDIA_STORAGE
    ];
    const mediaStorageReady = mediaStorage?.ready !== false;
    const webGlobalSettings = feed.settings.webGlobalSettings || {};
    const publicBucketUrl = resolvePublicBucketUrl(
      webGlobalSettings.publicBucketUrl,
      window.location.hostname,
    );
    return (<AdminPageApp>
      <form className="grid grid-cols-1 gap-4 xl:grid-cols-12" onSubmit={this.onSubmit}>
        <div className="grid grid-cols-1 gap-4 xl:col-span-9">
          <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
            <div className="flex flex-col gap-5 md:flex-row">
              <div className="flex-none">
                <ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.IMAGE]}/>
                <AdminImageUploaderApp
                  mediaType="channel"
                  feed={feed}
                  mediaStorage={mediaStorage}
                  mediaStorageReady={mediaStorageReady}
                  publicBucketUrl={publicBucketUrl}
                  currentImageUrl={channel.image}
                  imageMetadataTarget={{id: channel.id, type: 'channel'}}
                  onImageDeleted={() => this.setState((prevState: any) => ({
                    channel: {
                      ...prevState.channel,
                      image: undefined,
                    },
                  }))}
                  onImageUploaded={(
                    cdnUrl: any,
                    _contentType: any,
                    replacedImageUrl: unknown,
                  ) => this.setState((prevState: any) => ({
                    changed: true,
                    channel: {
                      ...prevState.channel,
                      image: cdnUrl,
                    },
                    replacedImageUrls: queueReplacedImageUrl(
                      prevState.replacedImageUrls,
                      replacedImageUrl,
                    ),
                  }))}
                />
              </div>
              <div className="grid flex-1 grid-cols-1 gap-3">
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.TITLE]}/>}
                  value={channel.title}
                  onChange={(e: any) => this.onUpdateChannelMeta('title', e.target.value)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <AdminSelect
                    value={categories.map((c: any) => ((CATEGORIES_DICT as any)[c]))}
                    ariaLabel="Categories"
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.CATEGORIES]}/>}
                    options={CATEGORIES_SELECT_OPTIONS}
                    onChange={(selectedOptions: any) => {
                      this.onUpdateChannelMeta('categories', [...selectedOptions.map((o: any) => o.value)]);
                    }}
                    multiple
                    isOptionDisabled={() => categories.length >= 3}
                  />
                  <AdminSelect
                    value={(LANGUAGE_CODES_DICT as any)[channel.language]}
                    ariaLabel="Language"
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
          <details className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
            <summary className="m-page-summary">
              Podcast-specific fields
            </summary>
            <div className="mt-8 grid grid-cols-1 gap-8">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <AdminRadioGroup
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_EXPLICIT]}/>}
                  name="lh-explicit"
                  value={channel['itunes:explicit'] ? 'yes' : 'no'}
                  options={[{
                    label: 'yes',
                    value: 'yes',
                  }, {
                    label: 'no',
                    value: 'no',
                  }]}
                  onValueChange={(value) => this.onUpdateChannelMeta('itunes:explicit', value === 'yes')}
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <AdminRadioGroup
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_TYPE]}/>}
                  name="feed-itunes-type"
                  value={channel['itunes:type']}
                  options={[{
                    label: 'episodic',
                    value: 'episodic',
                  }, {
                    label: 'serial',
                    value: 'serial',
                  }]}
                  onValueChange={(value) => this.onUpdateChannelMeta('itunes:type', value)}
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <AdminRadioGroup
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_BLOCK]}/>}
                  name="feed-itunes-block"
                  value={channel['itunes:block'] ? 'yes' : 'no'}
                  options={[{
                    label: 'yes',
                    value: 'yes',
                  }, {
                    label: 'no',
                    value: 'no',
                  }]}
                  onValueChange={(value) => this.onUpdateChannelMeta('itunes:block', value === 'yes')}
                />
                <AdminRadioGroup
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_COMPLETE]}/>}
                  name="feed-itunes-complete"
                  value={channel['itunes:complete'] ? 'yes' : 'no'}
                  options={[{
                    label: 'yes',
                    value: 'yes',
                  }, {
                    label: 'no',
                    value: 'no',
                  }]}
                  onValueChange={(value) => this.onUpdateChannelMeta('itunes:complete', value === 'yes')}
                />
              </div>
            </div>
          </details>
        </div>
        <div className="xl:col-span-3">
          <div className="grid gap-4 xl:sticky xl:top-4">
            <div className="rounded-[14px] border bg-card p-5 text-center text-card-foreground shadow-xs">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update'}
              </Button>
            </div>
            <AdminSideQuickLinks />
          </div>
        </div>
      </form>
    </AdminPageApp>);
  }
}
