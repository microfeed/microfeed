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
import AdminHelpLabel from "@/components/admin/shared/AdminHelpLabel";
import {CHANNEL_CONTROLS, CONTROLS_TEXTS_DICT} from "./AdminHelpContent";
import {
  preventCloseWhenChanged,
} from "@/client/BrowserUtils";
import AutosaveCoordinator, {
  type AutosaveState,
} from "@/client/AutosaveCoordinator";
import type {FeedContent, OnboardingResult} from "@/types";
import {queueReplacedImageUrl} from "@/client/ImageUploadUtils";
import AdminSaveAction from "@/components/admin/shared/AdminSaveAction";

interface ChannelSnapshot {
  channel: Record<string, unknown>;
  deleteImageUrls: string[];
}

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
  private autosave: AutosaveCoordinator<ChannelSnapshot>;
  private cleanupNavigationGuard?: () => void;
  private mounted = false;

  constructor(props: Props) {
    super(props);

    this.onUpdateChannelMeta = this.onUpdateChannelMeta.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.saveSnapshot = this.saveSnapshot.bind(this);

    const feed = props.feedContent;

    const channel = feed.channel;
    this.state = {
      feed,
      channel,
      autosaveState: {dirty: false, phase: "idle"} satisfies AutosaveState,
      replacedImageUrls: [],
    };

    this.autosave = new AutosaveCoordinator({
      delayMs: null,
      getSnapshot: () => ({
        channel: {...this.state.channel},
        deleteImageUrls: [...this.state.replacedImageUrls],
      }),
      onError: (error) => this.showSaveError(error),
      onStateChange: (autosaveState) => {
        if (this.mounted) this.setState({autosaveState});
      },
      save: this.saveSnapshot,
    });
  }

  componentDidMount() {
    this.mounted = true;
    this.cleanupNavigationGuard = preventCloseWhenChanged(
      () => this.autosave.hasUnsavedChanges(),
    );
  }

  componentWillUnmount() {
    this.mounted = false;
    this.autosave.dispose();
    this.cleanupNavigationGuard?.();
  }

  onUpdateChannelMeta(keyName: any, value: any) {
    this.setState((prevState: any) => ({
      channel: {
        ...prevState.channel,
        [keyName]: value,
      },
    }), () => this.autosave.markChanged());
  }

  onSubmit(e: any) {
    e.preventDefault();
    void this.autosave.flush();
  }

  async saveSnapshot(snapshot: ChannelSnapshot) {
    await Requests.axiosPost(ADMIN_URLS.ajaxFeed(), snapshot);
    if (!this.mounted) return;

    await new Promise<void>((resolve) => {
      this.setState((previousState: any) => ({
        feed: {
          ...previousState.feed,
          channel: snapshot.channel,
        },
        replacedImageUrls: previousState.replacedImageUrls.filter(
          (url: string) => !snapshot.deleteImageUrls.includes(url),
        ),
      }), resolve);
    });
    showToast('Channel saved.', 'success');
  }

  showSaveError(error: any) {
    if (!error?.response) {
      showToast('Network error. Your changes are still on this page.', 'error');
    } else {
      showToast('Couldn’t save. Your changes are still on this page.', 'error');
    }
  }

  render() {
    const {autosaveState, channel, feed} = this.state;
    const {onboardingResult} = this.props;
    const categories = channel.categories || [];
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
                <AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.IMAGE]}/>
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
                    channel: {
                      ...prevState.channel,
                      image: cdnUrl,
                    },
                    replacedImageUrls: queueReplacedImageUrl(
                      prevState.replacedImageUrls,
                      replacedImageUrl,
                    ),
                  }), () => this.autosave.markChanged())}
                />
              </div>
              <div className="grid flex-1 grid-cols-1 gap-3">
                <AdminInput
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.TITLE]}/>}
                  value={channel.title}
                  onChange={(e: any) => this.onUpdateChannelMeta('title', e.target.value)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <AdminInput
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.PUBLISHER]}/>}
                    value={channel.publisher}
                    onChange={(e: any) => this.onUpdateChannelMeta('publisher', e.target.value)}
                  />
                  <AdminInput
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.WEBSITE]}/>}
                    value={channel.link}
                    onChange={(e: any) => this.onUpdateChannelMeta('link', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <AdminSelect
                    value={categories.map((c: any) => ((CATEGORIES_DICT as any)[c]))}
                    ariaLabel="Categories"
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.CATEGORIES]}/>}
                    options={CATEGORIES_SELECT_OPTIONS}
                    onChange={(selectedOptions: any) => {
                      this.onUpdateChannelMeta(
                        'categories',
                        [...selectedOptions.map((o: any) => o.value)],
                      );
                    }}
                    multiple
                    isOptionDisabled={() => categories.length >= 3}
                  />
                  <AdminSelect
                    value={(LANGUAGE_CODES_DICT as any)[channel.language]}
                    ariaLabel="Language"
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.LANGUAGE]}/>}
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
                labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.DESCRIPTION]}/>}
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
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_EXPLICIT]}/>}
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
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.COPYRIGHT]}/>}
                  value={channel.copyright}
                  onChange={(e: any) => this.onUpdateChannelMeta('copyright', e.target.value)}
                />
                <AdminInput
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_TITLE]}/>}
                  value={channel['itunes:title']}
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:title', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <AdminRadioGroup
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_TYPE]}/>}
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
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_EMAIL]}/>}
                  type="email"
                  value={channel['itunes:email']}
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:email', e.target.value)}
                />
                <AdminInput
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_NEW_RSS_URL]}/>}
                  type="url"
                  value={channel['itunes:new-feed-url']}
                  onChange={(e: any) => this.onUpdateChannelMeta('itunes:new-feed-url', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <AdminRadioGroup
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_BLOCK]}/>}
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
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[CHANNEL_CONTROLS.ITUNES_COMPLETE]}/>}
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
            <AdminSaveAction
              {...autosaveState}
              buttonLabel="Save changes"
              idleMessage="Make changes, then select Save changes."
            />
            <AdminSideQuickLinks />
          </div>
        </div>
      </form>
    </AdminPageApp>);
  }
}
