import React from 'react';
import {Trash2Icon} from "lucide-react";
import {navigate} from 'astro:transitions/client';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import AdminInput from "@/components/admin/shared/AdminInput";
import Requests from "@/client/requests";
import {
  randomShortUUID,
  ADMIN_URLS,
  PUBLIC_URLS,
  resolvePublicBucketUrl,
} from '@/shared/StringUtils';
import AdminImageUploaderApp from "@/components/admin/shared/AdminImageUploaderApp";
import AdminDatetimePicker from '@/components/admin/shared/AdminDatetimePicker';
import {datetimeLocalStringToMs, datetimeLocalToMs} from "@/shared/TimeUtils";
import {getPublicBaseUrl} from "@/client/ClientUrlUtils";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import {showToast} from "@/client/ToastUtils";
import MediaManager from "./components/MediaManager";
import {
  ONBOARDING_TYPES,
  STATUSES,
  ITEM_STATUSES_DICT,
  ENCLOSURE_CATEGORIES,
} from "@/shared/Constants";
import {AdminSideQuickLinks, SideQuickLink} from "@/components/admin/shared/AdminSideQuickLinks";
import AdminRichEditor from "@/components/admin/shared/AdminRichEditor";
import AdminHelpLabel from "@/components/admin/shared/AdminHelpLabel";
import {
  ITEM_CONTROLS,
  CONTROLS_TEXTS_DICT
} from "./AdminHelpContent";
import {
  preventCloseWhenChanged,
} from "@/client/BrowserUtils";
import AutosaveCoordinator, {
  type AutosaveState,
} from "@/client/AutosaveCoordinator";
import {getMediaFileFromUrl} from "@/shared/MediaFileUtils";
import type {FeedContent, OnboardingResult} from "@/types";
import {Button} from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {queueReplacedImageUrl} from "@/client/ImageUploadUtils";
import AdminSaveAction from "@/components/admin/shared/AdminSaveAction";
import {cn} from "@/lib/utils";
import {MAX_CATEGORIES_PER_ITEM, type CategoryRecord} from "@/shared/Categories";
import {
  SERIES_KINDS,
  type SeriesKind,
  type SeriesRecord,
} from "@/shared/Series";

const SUBMIT_STATUS__START = 1;

function itemCategoryIds(item: Record<string, unknown>): string[] {
  const value = item.categories;
  if (!Array.isArray(value)) return [];
  return value.map((entry) =>
    typeof entry === "string"
      ? entry
      : (entry as {id?: unknown})?.id
  ).filter((id): id is string => typeof id === "string" && id.length > 0);
}

function itemKind(item: Record<string, unknown>): SeriesKind {
  const category = (item.mediaFile as {category?: unknown})?.category;
  return category === ENCLOSURE_CATEGORIES.AUDIO
    ? SERIES_KINDS.PODCAST
    : SERIES_KINDS.POST;
}

function itemSeriesId(item: Record<string, unknown>): string | null {
  const series = item.series;
  if (typeof series === "string") return series;
  const id = (series as {id?: unknown})?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function itemSeriesNumber(item: Record<string, unknown>): string {
  const series = item.series;
  const number = (series as {series_number?: unknown})?.series_number;
  return number === null || number === undefined || number === ""
    ? ""
    : String(number);
}

function initItem(itemId: string) {
  return ({
    status: STATUSES.UNPUBLISHED,
    pubDateMs: datetimeLocalToMs(new Date()),
    pubDateIsDraftDefault: true,
    guid: itemId,
    'itunes:explicit': false,
    'itunes:block': false,
    'itunes:episodeType': 'full',
  });
}

interface Props {
  categories: CategoryRecord[];
  feedContent: FeedContent;
  itemId?: string;
  onboardingResult: OnboardingResult;
  series: SeriesRecord[];
}

interface ItemSnapshot {
  deleteImageUrls: string[];
  item: Record<string, unknown>;
}

export default class EditItemApp extends React.Component<Props, any> {
  private autosave: AutosaveCoordinator<ItemSnapshot>;
  private cleanupNavigationGuard?: () => void;
  private mounted = false;
  private publishRequested = false;

  constructor(props: Props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.onPublish = this.onPublish.bind(this);
    this.onUpdateItemMeta = this.onUpdateItemMeta.bind(this);
    this.onUpdateItemStatus = this.onUpdateItemStatus.bind(this);
    this.saveSnapshot = this.saveSnapshot.bind(this);

    const action = props.itemId ? 'edit' : 'create';
    const itemId = props.itemId || randomShortUUID();
    const feed = {
      ...props.feedContent,
      items: props.feedContent.items ? [...props.feedContent.items] : [],
    };
    const item = feed.item
      ? {...feed.item, guid: feed.item.guid || itemId}
      : initItem(itemId);

    this.state = {
      feed,
      item,
      submitStatus: null,
      itemId,
      action,

      autoUpdateLink: action === 'create',
      userChangedLink: false,
      autosaveState: {dirty: false, phase: "idle"} satisfies AutosaveState,
      replacedImageUrls: [],
    };

    this.autosave = new AutosaveCoordinator({
      getSnapshot: () => ({
        deleteImageUrls: [...this.state.replacedImageUrls],
        item: {id: this.state.itemId, ...this.state.item},
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

    const {action, item} = this.state;
    if (action === 'create') {
      const {mediaFile} = item;
      const urlParams = new URLSearchParams(window.location.search);
      const title = urlParams.get('title') || '';

      const mediaFileFromUrl = getMediaFileFromUrl(urlParams);

      if (mediaFileFromUrl && Object.keys(mediaFileFromUrl).length > 0) {
        const attrDict = {
          title,
          mediaFile: {
            ...mediaFile,
            ...mediaFileFromUrl,
          },
        };
        this.onUpdateItemMeta(attrDict);
      }
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    this.autosave.dispose();
    this.cleanupNavigationGuard?.();
  }

  onUpdateItemMeta(attrDict: any, extraDict?: any, immediate = false) {
    this.setState((prevState: any) => ({
      item: {...prevState.item, ...attrDict,},
      ...extraDict,
    }), () => this.autosave.markChanged({immediate}));
  }

  onUpdateItemStatus(nextStatus: number) {
    const publicationFields = nextStatus === STATUSES.PUBLISHED &&
        this.state.item.pubDateIsDraftDefault === true
      ? {
          pubDateIsDraftDefault: false,
          pubDateMs: Date.now(),
        }
      : {};
    this.onUpdateItemMeta({
      ...publicationFields,
      status: nextStatus,
    }, undefined, true);
  }

  onPublish() {
    this.publishRequested = true;
    this.onUpdateItemStatus(STATUSES.PUBLISHED);
  }

  async onDelete() {
    if (!await this.autosave.flush()) return;

    const {item, itemId} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
      item: {id: itemId, ...item, status: STATUSES.DELETED},
    })
      .then(() => {
        showToast('Deleted!', 'success');
        this.setState({submitStatus: null}, () => {
          setTimeout(() => {
            void navigate(ADMIN_URLS.allItems());
          }, 1000);
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
  }

  onSubmit(e: any) {
    e.preventDefault();
    void this.autosave.flush();
  }

  async saveSnapshot(snapshot: ItemSnapshot) {
    await Requests.axiosPost(ADMIN_URLS.ajaxFeed(), snapshot);
    if (!this.mounted) return;

    const created = this.state.action === 'create';
    const publishRequested = this.publishRequested;
    this.publishRequested = false;
    await new Promise<void>((resolve) => {
      this.setState((previousState: any) => ({
        action: created ? 'edit' : previousState.action,
        feed: {
          ...previousState.feed,
          item: snapshot.item,
        },
        replacedImageUrls: previousState.replacedImageUrls.filter(
          (url: string) => !snapshot.deleteImageUrls.includes(url),
        ),
      }), () => {
        if (created) {
          window.history.replaceState(
            window.history.state,
            '',
            ADMIN_URLS.editItem(this.state.itemId),
          );
        }
        resolve();
      });
    });
    showToast(
      publishRequested && snapshot.item.status === STATUSES.PUBLISHED
        ? 'Item published'
        : created ? 'Item added.' : 'Item saved.',
      'success',
    );
  }

  showSaveError(error: any) {
    if (!error?.response) {
      showToast('Network error. Your changes are still on this page.', 'error');
    } else {
      showToast('Couldn’t save. Your changes are still on this page.', 'error');
    }
  }

  render() {
    const {autosaveState, submitStatus, itemId, item, action, feed} = this.state;
    const {onboardingResult} = this.props;
    const deleting = submitStatus === SUBMIT_STATUS__START;
    const {mediaFile} = item;
    const status = item.status || STATUSES.UNPUBLISHED;
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
            <MediaManager
              labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.MEDIA_FILE]}/>}
              feed={feed}
              mediaStorage={mediaStorage}
              mediaStorageReady={mediaStorageReady}
              initMediaFile={mediaFile || {}}
              onMediaFileUpdated={(newMediaFile: any, options?: {immediate?: boolean}) => {
                this.onUpdateItemMeta({
                  mediaFile: {
                    ...mediaFile,
                    ...newMediaFile,
                  },
                }, undefined, options?.immediate);
              }}
            />
          </div>
          <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
            <div className="flex">
              <div>
                <AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.IMAGE]}/>
                <AdminImageUploaderApp
                  mediaType="item"
                  feed={feed}
                  mediaStorage={mediaStorage}
                  mediaStorageReady={mediaStorageReady}
                  publicBucketUrl={publicBucketUrl}
                  currentImageUrl={item.image}
                  imageMetadataTarget={action === 'edit'
                    ? {id: itemId, type: 'item'}
                    : undefined}
                  onImageDeleted={() => {
                    if (action === 'edit') {
                      this.setState((prevState: any) => ({
                        item: {
                          ...prevState.item,
                          image: undefined,
                        },
                      }));
                    } else {
                      this.onUpdateItemMeta({image: undefined}, undefined, true);
                    }
                  }}
                  onImageUploaded={(
                    cdnUrl: any,
                    _contentType: any,
                    replacedImageUrl: unknown,
                  ) => this.setState((prevState: any) => ({
                    item: {...prevState.item, image: cdnUrl},
                    replacedImageUrls: queueReplacedImageUrl(
                      prevState.replacedImageUrls,
                      replacedImageUrl,
                    ),
                  }), () => this.autosave.markChanged({immediate: true}))}
                />
              </div>
              <div className="ml-8 flex-1">
                <AdminInput
                  labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.TITLE]}/>}
                  value={item.title}
                  onChange={(e: any) => {
                    const nextTitle = e.target.value;
                    const attrDict = {'title': nextTitle};
                    if (this.state.autoUpdateLink && !this.state.userChangedLink) {
                      (attrDict as any).link = PUBLIC_URLS.webItem(
                        itemId,
                        nextTitle,
                        getPublicBaseUrl(),
                      );
                    }
                    this.onUpdateItemMeta(attrDict);
                  }}
                />
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <AdminDatetimePicker
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.PUB_DATE]}/>}
                    value={item.pubDateMs}
                    onChange={(e: any) => {
                      this.onUpdateItemMeta({
                        'pubDateIsDraftDefault': false,
                        'pubDateMs': datetimeLocalStringToMs(e.target.value),
                      });
                    }}
                  />
                  <AdminInput
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.LINK]}/>}
                    value={item.link}
                    onChange={(e: any) => this.onUpdateItemMeta({'link': e.target.value}, {userChangedLink: true})}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <AdminRadioGroup
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.STATUS]}/>}
                    name="item-status"
                    value={String(status)}
                    options={[
                      {
                        label: (ITEM_STATUSES_DICT[STATUSES.PUBLISHED] as any).name,
                        value: String(STATUSES.PUBLISHED),
                      },
                      {
                        label: (ITEM_STATUSES_DICT[STATUSES.UNLISTED] as any).name,
                        value: String(STATUSES.UNLISTED),
                      },
                      {
                        label: (ITEM_STATUSES_DICT[STATUSES.UNPUBLISHED] as any).name,
                        value: String(STATUSES.UNPUBLISHED),
                      }]}
                    onValueChange={(value) =>
                      this.onUpdateItemStatus(parseInt(value, 10))}
                  />
                  <div className="text-muted-color text-xs" dangerouslySetInnerHTML={{__html: (ITEM_STATUSES_DICT[status] as any).description}} />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <AdminRichEditor
                labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.DESCRIPTION]}/>}
                value={item.description}
                onChange={(value: any) => this.onUpdateItemMeta({'description': value})}
                extra={{
                  publicBucketUrl,
                  folderName: `items/${itemId}`,
                  mediaStorageReady,
                }}
              />
            </div>
          </div>
          <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
            <div className="mb-2 text-sm font-semibold text-foreground">Categories</div>
            <p className="mb-4 text-xs text-muted-foreground">
              Assign up to {MAX_CATEGORIES_PER_ITEM} categories to this post.
            </p>
            {this.props.categories?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories yet. Add categories in the Categories page first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(this.props.categories ?? []).map((category) => {
                  const selected = itemCategoryIds(item).includes(category.id);
                  const atLimit = itemCategoryIds(item).length >= MAX_CATEGORIES_PER_ITEM;
                  const disabled = !selected && atLimit;
                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/30",
                        disabled && "cursor-not-allowed opacity-45",
                      )}
                      disabled={disabled}
                      key={category.id}
                      onClick={() => {
                        const current = itemCategoryIds(item);
                        const next = selected
                          ? current.filter((id) => id !== category.id)
                          : [...current, category.id];
                        this.onUpdateItemMeta({categories: next});
                      }}
                      type="button"
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
            <div className="mb-2 text-sm font-semibold text-foreground">Series</div>
            <p className="mb-4 text-xs text-muted-foreground">
              Group this {itemKind(item)} into a series. Posts and podcasts
              keep separate series.
            </p>
            {(() => {
              const kind = itemKind(item);
              const kindSeries = (this.props.series ?? []).filter(
                (entry) => entry.kind === kind,
              );
              const selectedId = itemSeriesId(item);
              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="item-series">
                      Series
                    </label>
                    <select
                      className="rounded-[10px] border bg-card px-3 py-2 text-sm"
                      id="item-series"
                      onChange={(event) => {
                        const value = event.target.value;
                        const current = item.series as Record<string, unknown> | null;
                        this.onUpdateItemMeta({
                          series: value
                            ? {
                                ...(current && typeof current === "object"
                                  ? current
                                  : {}),
                                id: value,
                              }
                            : null,
                        });
                      }}
                      value={selectedId ?? ""}
                    >
                      <option value="">No series</option>
                      {kindSeries.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                    {kindSeries.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No {kind} series yet. Add one in the Series page first.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="item-series-number">
                      Series number
                    </label>
                    <input
                      className="rounded-[10px] border bg-card px-3 py-2 text-sm"
                      id="item-series-number"
                      min="1"
                      onChange={(event) => {
                        const value = event.target.value;
                        const current = item.series as Record<string, unknown> | null;
                        this.onUpdateItemMeta({
                          series: {
                            ...(current && typeof current === "object"
                              ? current
                              : {}),
                            series_number: value === "" ? null : Number(value),
                          },
                        });
                      }}
                      placeholder="Optional"
                      type="number"
                      value={itemSeriesNumber(item)}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
            <details>
              <summary className="m-page-summary">Podcast-specific fields</summary>
              <div className="grid grid-cols-1 gap-8">
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <AdminRadioGroup
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EXPLICIT]}/>}
                    name="lh-explicit"
                    value={item['itunes:explicit'] ? 'yes' : 'no'}
                    options={[{
                      label: 'yes',
                      value: 'yes',
                    }, {
                      label: 'no',
                      value: 'no',
                    }]}
                    onValueChange={(value) => this.onUpdateItemMeta({'itunes:explicit': value === 'yes'})}
                  />
                  <AdminInput
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.GUID]}/>}
                    value={item.guid || itemId}
                    onChange={(e: any) => this.onUpdateItemMeta({'guid': e.target.value})}
                  />
                  <AdminInput
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_TITLE]}/>}
                    value={item['itunes:title']}
                    onChange={(e: any) => this.onUpdateItemMeta({'itunes:title': e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <AdminRadioGroup
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EPISODE_TYPE]}/>}
                    name="feed-itunes-episodetype"
                    value={item['itunes:episodeType']}
                    options={[{
                      label: 'full',
                      value: 'full',
                    }, {
                      label: 'trailer',
                      value: 'trailer',
                    }, {
                      label: 'bonus',
                      value: 'bonus',
                    },
                    ]}
                    onValueChange={(value) => this.onUpdateItemMeta({'itunes:episodeType': value})}
                  />
                  <AdminInput
                    type="number"
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_SEASON]}/>}
                    value={item['itunes:season']}
                    extraParams={{min: "1"}}
                    onChange={(e: any) => this.onUpdateItemMeta({'itunes:season': e.target.value})}
                  />
                  <AdminInput
                    type="number"
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EPISODE]}/>}
                    value={item['itunes:episode']}
                    extraParams={{min: "1"}}
                    onChange={(e: any) => this.onUpdateItemMeta({'itunes:episode': e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <AdminRadioGroup
                    labelComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_BLOCK]}/>}
                    name="feed-itunes-block"
                    value={item['itunes:block'] ? 'yes' : 'no'}
                    options={[{
                      label: 'Yes',
                      value: 'yes',
                    }, {
                      label: 'No',
                      value: 'no',
                    }]}
                    onValueChange={(value) => this.onUpdateItemMeta({'itunes:block': value === 'yes'})}
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
        <div className="xl:col-span-3">
          <div className="grid gap-4 xl:sticky xl:top-4">
            <AdminSaveAction
              {...autosaveState}
              idleMessage={action === 'create'
                ? 'Start editing to create an unpublished draft.'
                : undefined}
            >
              {status !== STATUSES.PUBLISHED && (
                <>
                  <Button
                    aria-describedby="publish-item-description"
                    className="w-full"
                    disabled={autosaveState.phase === "saving"}
                    onClick={this.onPublish}
                    type="button"
                    variant="outline"
                  >
                    Publish
                  </Button>
                  <p
                    className="mt-2 text-xs text-muted-foreground"
                    id="publish-item-description"
                  >
                    Save and change status to published
                  </p>
                </>
              )}
            </AdminSaveAction>
            {action === 'edit' && <div>
              <AdminSideQuickLinks
                AdditionalLinksDiv={<div className="flex flex-wrap">
                  <SideQuickLink url={PUBLIC_URLS.webItem(itemId, item.title)} text="web item"/>
                  <SideQuickLink url={PUBLIC_URLS.jsonItem(itemId)} text="json item"/>
                </div>}
              />
              <div className="mt-4 flex justify-center rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
                <AlertDialog>
                  <AlertDialogTrigger render={<Button disabled={deleting} type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" />}>
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    Delete this item
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the item from your dashboard and public feeds. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction disabled={deleting} type="button" variant="destructive" onClick={this.onDelete}>
                        {deleting ? 'Deleting...' : 'Delete item'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>}
          </div>
        </div>
      </form>
    </AdminPageApp>);
  }
}
