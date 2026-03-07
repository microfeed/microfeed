import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminInput from "../../../components/AdminInput";
import AdminSelect from "../../../components/AdminSelect";
import AdminTextarea from "../../../components/AdminTextarea";
import Requests from "../../../common/requests";
import {buildItemSlug, randomShortUUID, ADMIN_URLS, PUBLIC_URLS} from '../../../../common-src/StringUtils';
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import AdminDatetimePicker from '../../../components/AdminDatetimePicker';
import {datetimeLocalStringToMs, datetimeLocalToMs} from "../../../../common-src/TimeUtils";
import {getPublicBaseUrl} from "../../../common/ClientUrlUtils";
import AdminRadio from "../../../components/AdminRadio";
import {showToast} from "../../../common/ToastUtils";
import {unescapeHtml} from "../../../../common-src/StringUtils";
import MediaManager from "./components/MediaManager";
import {
  NAV_ITEMS,
  NAV_ITEMS_DICT,
  STATUSES,
  ITEM_STATUSES_DICT,
} from "../../../../common-src/Constants";
import {AdminSideQuickLinks, SideQuickLink} from "../../../components/AdminSideQuickLinks";
import AdminRichEditor from "../../../components/AdminRichEditor";
import ExplainText from "../../../components/ExplainText";
import {
  ITEM_CONTROLS,
  CONTROLS_TEXTS_DICT
} from "./FormExplainTexts";
import {preventCloseWhenChanged} from "../../../common/BrowserUtils";
import {getMediaFileFromUrl} from "../../../../common-src/MediaFileUtils";

const SUBMIT_STATUS__START = 1;

function initItem(itemId) {
  return ({
    status: STATUSES.PUBLISHED,
    pubDateMs: datetimeLocalToMs(new Date()),
    guid: itemId,
    slug: '',
    seoTitle: '',
    seoDescription: '',
    canonicalUrl: '',
    noindex: false,
    ogImage: '',
    typeId: null,
    primaryCategoryId: null,
    secondaryCategoryId: null,
    itunesSeriesId: null,
    'itunes:explicit': false,
    'itunes:block': false,
    'itunes:episodeType': 'full',
  });
}

export default class EditItemApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.onHardDelete = this.onHardDelete.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateItemMeta = this.onUpdateItemMeta.bind(this);
    this.onUpdateItemToFeed = this.onUpdateItemToFeed.bind(this);

    const $feedContent = document.getElementById('feed-content');
    const $dataParams = document.getElementById('lh-data-params');
    const onboardingResult = JSON.parse(unescapeHtml(document.getElementById('onboarding-result').innerHTML));

    const itemId = $dataParams ? $dataParams.getAttribute('data-item-id') : null;
    const action = itemId ? 'edit' : 'create';
    const feed = JSON.parse(unescapeHtml($feedContent.innerHTML));
    if (!feed.items) {
      feed.items = [];
    }
    const itemTypes = feed.itemTypes || [];
    const podcastType = itemTypes.find((type) => type.slug === 'podcast');
    const item = feed.item || initItem();
    if (!item.typeId && podcastType) {
      item.typeId = podcastType.id;
    } else if (!item.typeId && itemTypes.length > 0) {
      item.typeId = itemTypes[0].id;
    }
    if (!item.slug && item.title) {
      item.slug = buildItemSlug(item.title);
    }

    this.state = {
      feed,
      onboardingResult,
      item,
      submitStatus: null,
      itemId: itemId || randomShortUUID(),
      action,

      userChangedLink: false,
      userChangedSlug: false,
      changed: false,
    };
  }

  componentDidMount() {
    preventCloseWhenChanged(() => this.state.changed);

    const {action, item} = this.state;
    if (action === 'create') {
      const {mediaFile} = item;
      const urlParams = new URLSearchParams(window.location.search);
      const title = urlParams.get('title') || '';

      const mediaFileFromUrl = getMediaFileFromUrl(urlParams);

      if (mediaFileFromUrl && Object.keys(mediaFileFromUrl).length > 0) {
        const attrDict = {
          title,
          slug: buildItemSlug(title),
          mediaFile: {
            ...mediaFile,
            ...mediaFileFromUrl,
          },
        };
        this.onUpdateItemMeta(attrDict);
      }
    }
  }

  onUpdateFeed(props, onSuccess) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        ...props,
      },
    }), () => onSuccess())
  }

  onUpdateItemMeta(attrDict, extraDict) {
    this.setState(prevState => ({
      changed: true,
      item: {...prevState.item, ...attrDict,},
      ...extraDict,
    }));
  }

  onUpdateItemToFeed(onSuccess) {
    let {item, itemId, feed} = this.state;
    const itemsBundle = {
      ...feed.items,
      [itemId]: {...item},
    };
    this.onUpdateFeed({'items': itemsBundle}, onSuccess);
  }

  onDelete() {
    const {item} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {item: {...item, status: STATUSES.ARCHIVED}})
      .then(() => {
        showToast('Archived!', 'success');
        this.setState({submitStatus: null, changed: false}, () => {
          setTimeout(() => {
            location.href = ADMIN_URLS.allItems();
          }, 1000);
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
  }

  onHardDelete() {
    const {itemId} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    fetch(`${ADMIN_URLS.home()}ajax/items/${itemId}?hard=true`, {
      method: 'DELETE',
    }).then((res) => {
      if (res.ok) {
        showToast('Permanently deleted!', 'success');
        this.setState({submitStatus: null, changed: false}, () => {
          setTimeout(() => {
            location.href = ADMIN_URLS.allItems();
          }, 1000);
        });
      } else {
        this.setState({submitStatus: null}, () => {
          showToast('Failed. Please try again.', 'error');
        });
      }
    }).catch(() => {
      this.setState({submitStatus: null}, () => {
        showToast('Network error. Please refresh the page and try again.', 'error');
      });
    });
  }

  onSubmit(e) {
    e.preventDefault();
    const {item, itemId, action} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {item: {id: itemId, ...item}})
      .then(() => {
        this.setState({submitStatus: null, changed: false}, () => {
          if (action === 'edit') {
            showToast('Updated!', 'success');
          } else {
            showToast('Created!', 'success');
            if (itemId) {
              setTimeout(() => {
                location.href = ADMIN_URLS.editItem(itemId);
              }, 1000);
            }
          }
        });
      }).catch((error) => {
      this.setState({submitStatus: null}, () => {
        if (!error.response) {
          showToast('Network error. Please refresh the page and try again.', 'error');
        } else {
          showToast('Failed. Please try again.', 'error');
        }
      });
    });
  }

  render() {
    const {submitStatus, itemId, item, action, feed, onboardingResult, changed} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const {mediaFile} = item;
    const status = item.status || STATUSES.PUBLISHED;

    const webGlobalSettings = feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';
    const itemTypes = feed.itemTypes || [];
    const categories = feed.categories || [];
    const itunesSeries = feed.itunesSeries || [];
    const categoryById = {};
    categories.forEach((cat) => {
      categoryById[cat.id] = cat;
    });
    const typeOptions = itemTypes.map((type) => ({
      value: type.id,
      label: type.name,
      slug: type.slug,
    }));
    const typeIdValue = typeof item.typeId === 'string' ? parseInt(item.typeId, 10) : item.typeId;
    const primaryCategoryIdValue = typeof item.primaryCategoryId === 'string' ?
      parseInt(item.primaryCategoryId, 10) : item.primaryCategoryId;
    const secondaryCategoryIdValue = typeof item.secondaryCategoryId === 'string' ?
      parseInt(item.secondaryCategoryId, 10) : item.secondaryCategoryId;
    const itunesSeriesIdValue = typeof item.itunesSeriesId === 'string' ?
      parseInt(item.itunesSeriesId, 10) : item.itunesSeriesId;
    const selectedType = typeOptions.find((type) => type.value === typeIdValue) || null;
    const categoryOptions = categories.map((cat) => {
      const parent = cat.parentId ? categoryById[cat.parentId] : null;
      const label = parent ? `${parent.name} / ${cat.name}` : cat.name;
      return {
        value: cat.id,
        label,
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
    const primaryCategory = categoryOptions.find((cat) => cat.value === primaryCategoryIdValue) || null;
    const secondaryCategory = categoryOptions.find((cat) => cat.value === secondaryCategoryIdValue) || null;
    const itunesSeriesOptions = itunesSeries.map((series) => ({
      value: series.id,
      label: series.name,
    }));
    const selectedSeries = itunesSeriesOptions.find((series) => series.value === itunesSeriesIdValue) || null;
    const isPodcastType = selectedType && selectedType.slug === 'podcast';

    let buttonText = 'Create';
    let submittingButtonText = 'Creating...';
    let currentPage = NAV_ITEMS.NEW_ITEM;
    let upperLevel;
    if (action === 'edit') {
      buttonText = 'Update';
      submittingButtonText = 'Updating...';
      currentPage = NAV_ITEMS.ALL_ITEMS;
      upperLevel = {
        name: NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name,
        url: ADMIN_URLS.allItems(),
        childName: `Item (id = ${itemId})`,
      };
    }
    return (<AdminNavApp
      currentPage={currentPage}
      upperLevel={upperLevel}
      onboardingResult={onboardingResult}
    >
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 grid grid-cols-1 gap-4">
          <div className="lh-page-card">
            <MediaManager
              labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.MEDIA_FILE]}/>}
              feed={feed}
              initMediaFile={mediaFile || {}}
              onMediaFileUpdated={(newMediaFile) => {
                this.onUpdateItemMeta({
                  mediaFile: {
                    ...mediaFile,
                    ...newMediaFile,
                  },
                });
              }}
            />
          </div>
          <div className="lh-page-card">
            <div className="flex">
              <div>
                <ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.IMAGE]}/>
                <AdminImageUploaderApp
                  mediaType="item"
                  feed={feed}
                  currentImageUrl={item.image}
                  onImageUploaded={(cdnUrl) => this.onUpdateItemMeta({'image': cdnUrl})}
                />
              </div>
              <div className="ml-8 flex-1">
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.TITLE]}/>}
                  value={item.title}
                  onChange={(e) => {
                    const attrDict = {'title': e.target.value};
                    if (!this.state.userChangedSlug) {
                      attrDict.slug = buildItemSlug(e.target.value);
                    }
                    if (action !== 'edit' && !this.state.userChangedLink) {
                      attrDict.link = PUBLIC_URLS.webItem(itemId, e.target.value, getPublicBaseUrl(), 'en', attrDict.slug);
                    }
                    this.onUpdateItemMeta(attrDict);
                  }}
                />
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <AdminInput
                    label="Slug"
                    value={item.slug}
                    onChange={(e) => {
                      this.onUpdateItemMeta(
                        {'slug': buildItemSlug(e.target.value)},
                        {userChangedSlug: true}
                      );
                    }}
                  />
                  <AdminSelect
                    label="Type"
                    value={selectedType}
                    options={typeOptions}
                    onChange={(option) => {
                      const newTypeId = option ? option.value : null;
                      const isPodcast = option && option.slug === 'podcast';
                      this.onUpdateItemMeta({
                        typeId: newTypeId,
                        itunesSeriesId: isPodcast ? item.itunesSeriesId : null,
                      });
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <AdminSelect
                    label="Primary category"
                    value={primaryCategory}
                    options={categoryOptions}
                    extraParams={{isClearable: true}}
                    onChange={(option) => {
                      const newPrimaryId = option ? option.value : null;
                      this.onUpdateItemMeta({
                        primaryCategoryId: newPrimaryId,
                        secondaryCategoryId: newPrimaryId === secondaryCategoryIdValue ? null : secondaryCategoryIdValue,
                      });
                    }}
                  />
                  <AdminSelect
                    label="Secondary category (optional)"
                    value={secondaryCategory}
                    options={categoryOptions.filter((option) => option.value !== primaryCategoryIdValue)}
                    extraParams={{isClearable: true}}
                    onChange={(option) => {
                      const newSecondaryId = option ? option.value : null;
                      this.onUpdateItemMeta({
                        secondaryCategoryId: newSecondaryId === primaryCategoryIdValue ? null : newSecondaryId,
                      });
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <AdminDatetimePicker
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.PUB_DATE]}/>}
                    value={item.pubDateMs}
                    onChange={(e) => {
                      this.onUpdateItemMeta({'pubDateMs': datetimeLocalStringToMs(e.target.value)});
                    }}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.LINK]}/>}
                    value={item.link}
                    onChange={(e) => this.onUpdateItemMeta({'link': e.target.value}, {userChangedLink: true})}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <AdminRadio
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.STATUS]}/>}
                    groupName="item-status"
                    buttons={[
                      {
                        name: ITEM_STATUSES_DICT[STATUSES.PUBLISHED].name,
                        value: STATUSES.PUBLISHED,
                        checked: status === STATUSES.PUBLISHED,
                      },
                      {
                        name: ITEM_STATUSES_DICT[STATUSES.UNLISTED].name,
                        value: STATUSES.UNLISTED,
                        checked: status === STATUSES.UNLISTED,
                      },
                      {
                        name: ITEM_STATUSES_DICT[STATUSES.UNPUBLISHED].name,
                        value: STATUSES.UNPUBLISHED,
                        checked: status === STATUSES.UNPUBLISHED,
                      }]}
                    onChange={(e) => {
                      this.onUpdateItemMeta({'status': parseInt(e.target.value, 10)})
                    }}
                  />
                  <div className="text-muted-color text-xs" dangerouslySetInnerHTML={{__html: ITEM_STATUSES_DICT[status].description}} />
                </div>
                <div className="mt-6">
                  <details>
                    <summary className="m-page-summary">SEO</summary>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <AdminInput
                        label="SEO title"
                        value={item.seoTitle}
                        onChange={(e) => this.onUpdateItemMeta({'seoTitle': e.target.value})}
                      />
                      <AdminInput
                        label="Canonical URL"
                        value={item.canonicalUrl}
                        onChange={(e) => this.onUpdateItemMeta({'canonicalUrl': e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 mt-4">
                      <AdminTextarea
                        label="SEO description"
                        value={item.seoDescription}
                        onChange={(e) => this.onUpdateItemMeta({'seoDescription': e.target.value})}
                        minRows={3}
                        maxRows={6}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <AdminInput
                        label="OG image URL"
                        value={item.ogImage}
                        onChange={(e) => this.onUpdateItemMeta({'ogImage': e.target.value})}
                      />
                      <AdminRadio
                        label="Noindex"
                        groupName="item-noindex"
                        buttons={[
                          {name: 'No', checked: !item.noindex},
                          {name: 'Yes', checked: !!item.noindex},
                        ]}
                        value={item.noindex}
                        onChange={(e) => this.onUpdateItemMeta({'noindex': e.target.value === 'Yes'})}
                      />
                    </div>
                  </details>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <AdminRichEditor
                labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.DESCRIPTION]}/>}
                value={item.description}
                onChange={(value) => this.onUpdateItemMeta({'description': value})}
                extra={{
                  publicBucketUrl,
                  folderName: `items/${itemId}`,
                }}
              />
            </div>
          </div>
          <div className="lh-page-card">
            <details>
              <summary className="m-page-summary">Podcast-specific fields</summary>
              <div className="grid grid-cols-1 gap-8">
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <AdminRadio
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EXPLICIT]}/>}
                    groupName="lh-explicit"
                    buttons={[{
                      'name': 'yes',
                      'checked': item['itunes:explicit'],
                    }, {
                      'name': 'no',
                      'checked': !item['itunes:explicit'],
                    }]}
                    value={item['itunes:explicit']}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:explicit': e.target.value === 'yes'})}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.GUID]}/>}
                    value={item.guid || itemId}
                    setRef={(ref) => {
                      if (!item.guid && ref) {
                        this.onUpdateItemMeta({'guid': ref.value}, {changed: false});
                      }
                    }}
                    onChange={(e) => this.onUpdateItemMeta({'guid': e.target.value})}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_TITLE]}/>}
                    value={item['itunes:title']}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:title': e.target.value})}
                  />
                </div>
                {isPodcastType && <div className="grid grid-cols-2 gap-4">
                  <AdminSelect
                    label="iTunes series"
                    value={selectedSeries}
                    options={itunesSeriesOptions}
                    extraParams={{isClearable: true}}
                    onChange={(option) => {
                      this.onUpdateItemMeta({'itunesSeriesId': option ? option.value : null});
                    }}
                  />
                </div>}
                <div className="grid grid-cols-3 gap-4">
                  <AdminRadio
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EPISODE_TYPE]}/>}
                    groupName="feed-itunes-episodetype"
                    buttons={[{
                      'name': 'full',
                      'checked': item['itunes:episodeType'] === 'full',
                    }, {
                      'name': 'trailer',
                      'checked': item['itunes:episodeType'] === 'trailer',
                    }, {
                      'name': 'bonus',
                      'checked': item['itunes:episodeType'] === 'bonus',
                    },
                    ]}
                    value={item['itunes:episodeType']}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:episodeType': e.target.value})}
                  />
                  <AdminInput
                    type="number"
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_SEASON]}/>}
                    value={item['itunes:season']}
                    extraParams={{min: "1"}}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:season': e.target.value})}
                  />
                  <AdminInput
                    type="number"
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EPISODE]}/>}
                    value={item['itunes:episode']}
                    extraParams={{min: "1"}}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:episode': e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <AdminRadio
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_BLOCK]}/>}
                    groupName="feed-itunes-block"
                    buttons={[{
                      'name': 'Yes',
                      'checked': item['itunes:block'],
                    }, {
                      'name': 'No',
                      'checked': !item['itunes:block'],
                    }]}
                    value={item['itunes:block']}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:block': e.target.value === 'Yes'})}
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
        <div className="col-span-3">
          <div className="sticky top-8">
            <div className="lh-page-card text-center">
              <button
                type="submit"
                className="lh-btn lh-btn-brand-dark lh-btn-lg"
                onClick={this.onSubmit}
                disabled={submitting || !changed}
              >
                {submitting ? submittingButtonText : buttonText}
              </button>
            </div>
            {action === 'edit' && <div>
              <AdminSideQuickLinks
                AdditionalLinksDiv={<div className="flex flex-wrap">
                  <SideQuickLink url={PUBLIC_URLS.webItem(itemId, item.title, '/', 'en', item.slug)} text="web item"/>
                  <SideQuickLink url={PUBLIC_URLS.jsonItem(itemId, null, '/', 'en', item.slug)} text="json item"/>
                </div>}
              />
              <div className="lh-page-card mt-4 flex flex-col items-center gap-2">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const ok = confirm('Are you going to archive this item?');
                    if (ok) {
                      this.onDelete();
                    }
                  }
                }><div className="flex items-center text-red-500 text-sm hover:text-brand-light">
                  <TrashIcon className="w-4" />
                  <div className="ml-1">Archive this item</div>
                  </div>
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const ok = confirm('This will permanently delete the item and its media files. Continue?');
                    if (ok) {
                      this.onHardDelete();
                    }
                  }
                }><div className="flex items-center text-red-600 text-sm hover:text-brand-light">
                  <TrashIcon className="w-4" />
                  <div className="ml-1">Hard delete</div>
                  </div>
                </a>
              </div>
            </div>}
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
