import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminInput from "../../../components/AdminInput";
import Requests from "../../../common/requests";
import {randomShortUUID, ADMIN_URLS, PUBLIC_URLS, urlJoinWithRelative} from '../../../../common-src/StringUtils';
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import AdminDatetimePicker from '../../../components/AdminDatetimePicker';
import {datetimeLocalStringToMs, datetimeLocalToMs} from "../../../../common-src/TimeUtils";
import {getPublicBaseUrl} from "../../../common/ClientUrlUtils";
import AdminRadio from "../../../components/AdminRadio";
import {showToast} from "../../../common/ToastUtils";
import {unescapeHtml} from "../../../../common-src/StringUtils";
import MediaManager from "./components/MediaManager";
import {NAV_ITEMS, NAV_ITEMS_DICT, STATUSES, ITEM_STATUSES_DICT} from "../../../../common-src/Constants";
import {AdminSideQuickLinks, SideQuickLink} from "../../../components/AdminSideQuickLinks";
import AdminRichEditor from "../../../components/AdminRichEditor";
import ExplainText from "../../../components/ExplainText";
import {
  ITEM_CONTROLS,
  CONTROLS_TEXTS_DICT
} from "./FormExplainTexts";

const SUBMIT_STATUS__START = 1;

function initItem(itemId) {
  return ({
    status: STATUSES.PUBLISHED,
    pubDateMs: datetimeLocalToMs(new Date()),
    guid: itemId,
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
    const item = feed.item || initItem();

    if (action === 'create') {
      const urlParams = new URLSearchParams(window.location.search);
      const title = urlParams.get('title');
      if (title) {
        item.title = title;
      }
    }
    this.state = {
      feed,
      onboardingResult,
      item,
      submitStatus: null,
      itemId: itemId || randomShortUUID(),
      action,

      userChangedLink: false,
      changed: false,
    };
  }

  componentDidMount() {
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
    Requests.post(ADMIN_URLS.ajaxFeed(), {item: {...item, status: STATUSES.DELETED}})
      .then(() => {
        showToast('Deleted!', 'success');
        setTimeout(() => {
          this.setState({submitStatus: null}, () => {
            location.href = ADMIN_URLS.allItems();
          });
        }, 1000);
      });
  }

  onSubmit(e) {
    e.preventDefault();

    const {item, itemId, action} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.post(ADMIN_URLS.ajaxFeed(), {item: {id: itemId, ...item}})
      .then(() => {
        if (action === 'edit') {
          this.setState({submitStatus: null}, () => {
            showToast('Updated!', 'success');
          });
        } else {
          showToast('Created!', 'success');
          setTimeout(() => {
            this.setState({submitStatus: null}, () => {
              if (itemId) {
                location.href = ADMIN_URLS.editItem(itemId);
              }
            });
          }, 1000);
        }
      });
  }

  render() {
    const {submitStatus, itemId, item, action, feed, onboardingResult, changed} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const {mediaFile} = item;
    const status = item.status || STATUSES.PUBLISHED;

    const webGlobalSettings = feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';

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
              mediaFile={mediaFile}
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
                  onImageUploaded={(cdnUrl) => this.onUpdateItemMeta({'image': urlJoinWithRelative(publicBucketUrl, cdnUrl)})}
                />
              </div>
              <div className="ml-8 flex-1 grid grid-cols-1 gap-4">
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.TITLE]}/>}
                  value={item.title}
                  onChange={(e) => {
                    const attrDict = {'title': e.target.value};
                    if (action !== 'edit' && !this.state.userChangedLink) {
                      attrDict.link = PUBLIC_URLS.webItem(itemId, item.title, getPublicBaseUrl());
                    }
                    this.onUpdateItemMeta(attrDict);
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                        name: ITEM_STATUSES_DICT[STATUSES.UNPUBLISHED].name,
                        value: STATUSES.UNPUBLISHED,
                        checked: status === STATUSES.UNPUBLISHED,
                      }]}
                    onChange={(e) => {
                      this.onUpdateItemMeta({'status': parseInt(e.target.value, 10)})
                    }}
                  />
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
                        this.onUpdateItemMeta({'guid': ref.value});
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
                  <SideQuickLink url={PUBLIC_URLS.webItem(itemId, item.title)} text="web item"/>
                  <SideQuickLink url={PUBLIC_URLS.jsonItem(itemId)} text="json item"/>
                </div>}
              />
              <div className="lh-page-card mt-4 flex justify-center">
                <a
                  href="#"
                  className="text-red-500 text-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    const ok = confirm('Are you going to permanently delete this item?');
                    if (ok) {
                      this.onDelete();
                    }
                  }
                }><div className="flex items-center">
                  <TrashIcon className="w-4" />
                  <div className="ml-1">Delete this item</div>
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
