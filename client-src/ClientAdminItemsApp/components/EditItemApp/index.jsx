import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminInput from "../../../components/AdminInput";
import Requests from "../../../common/requests";
import {randomShortUUID, ADMIN_URLS, PUBLIC_URLS} from '../../../../common-src/StringUtils';
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
    const itemId = $dataParams ? $dataParams.getAttribute('data-item-id') : null;
    const action = itemId ? 'edit' : 'create';
    const feed = JSON.parse(unescapeHtml($feedContent.innerHTML));
    if (!feed.items) {
      feed.items = [];
    }
    const item = feed.item || initItem();
    this.state = {
      feed,
      item,
      submitStatus: null,
      itemId: itemId || randomShortUUID(),
      action,

      userChangedLink: false,
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
    this.setState(prevState => ({item: {...prevState.item, ...attrDict,}, ...extraDict}));
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
    const {submitStatus, itemId, item, action, feed} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const {mediaFile} = item;
    const status = item.status || STATUSES.PUBLISHED;

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
    return (<AdminNavApp currentPage={currentPage} upperLevel={upperLevel}>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 grid grid-cols-1 gap-4">
          <div className="lh-page-card">
            <MediaManager
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
            <h2 className="lh-page-title">Metadata</h2>
            <div className="flex">
              <div>
                <AdminImageUploaderApp
                  mediaType="item"
                  feed={feed}
                  currentImageUrl={item.image}
                  onImageUploaded={(cdnUrl) => this.onUpdateItemMeta({'image': cdnUrl})}
                />
              </div>
              <div className="ml-8 flex-1 grid grid-cols-1 gap-4">
                <AdminInput
                  label="Title"
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
                    label="Published date"
                    value={item.pubDateMs}
                    onChange={(e) => {
                      this.onUpdateItemMeta({'pubDateMs': datetimeLocalStringToMs(e.target.value)});
                    }}
                  />
                  <AdminInput
                    label="Link"
                    value={item.link}
                    onChange={(e) => this.onUpdateItemMeta({'link': e.target.value}, {userChangedLink: true})}
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <AdminRichEditor
                label="Description"
                value={item.description}
                onChange={(value) => this.onUpdateItemMeta({'description': value})}
              />
            </div>
            <div className="mt-8 pt-8 border-t grid grid-cols-1 gap-8">
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="<guid>"
                  value={item.guid || itemId}
                  setRef={(ref) => {
                    if (!item.guid && ref) {
                      this.onUpdateItemMeta({'guid': ref.value});
                    }
                  }}
                  onChange={(e) => this.onUpdateItemMeta({'guid': e.target.value})}
                />
                <AdminInput
                  label="<itunes:title>"
                  value={item['itunes:title']}
                  onChange={(e) => this.onUpdateItemMeta({'itunes:title': e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminRadio
                  label="<itunes:episodeType>"
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
                  label="<itunes:season>"
                  value={item['itunes:season']}
                  extraParams={{min: "1"}}
                  onChange={(e) => this.onUpdateItemMeta({'itunes:season': e.target.value})}
                />
                <AdminInput
                  type="number"
                  label="<itunes:episode>"
                  value={item['itunes:episode']}
                  extraParams={{min: "1"}}
                  onChange={(e) => this.onUpdateItemMeta({'itunes:episode': e.target.value})}
                />
              </div>
              <div className="grid grid-cols-5 gap-4">
                <AdminRadio
                  label="<itunes:explicit>"
                  groupName="lh-explicit"
                  buttons={[{
                    'name': 'Yes',
                    'checked': item['itunes:explicit'],
                  }, {
                    'name': 'No',
                    'checked': !item['itunes:explicit'],
                  }]}
                  value={item['itunes:explicit']}
                  onChange={(e) => this.onUpdateItemMeta({'itunes:explicit': e.target.value === 'Yes'})}
                />
                <AdminRadio
                  label="<itunes:block>"
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
          </div>
        </div>
        <div className="col-span-3">
          <div className="sticky top-8">
            <div className="lh-page-card text-center">
              <div className="mb-8">
                <div className="flex justify-center">
                <AdminRadio
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
                <div className="text-muted-color text-xs mt-1">{ITEM_STATUSES_DICT[status].description}</div>
              </div>
              <button
                type="submit"
                className="lh-btn lh-btn-brand-dark lh-btn-lg"
                onClick={this.onSubmit}
                disabled={submitting}
              >
                {submitting ? submittingButtonText : buttonText}
              </button>
            </div>
            {action === 'edit' && <div>
              <AdminSideQuickLinks AdditionalLink={<SideQuickLink url={PUBLIC_URLS.webItem(itemId, item.title)} text="Item Web"/>}/>
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
