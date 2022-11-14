import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminInput from "../../../components/AdminInput";
import Requests from "../../../common/requests";
import {randomShortUUID, ADMIN_URLS, PUBLIC_URLS} from '../../../../common-src/StringUtils';
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import AdminTextarea from "../../../components/AdminTextarea";
import AdminDatetimePicker from '../../../components/AdminDatetimePicker';
import {datetimeLocalStringToMs, datetimeLocalToMs} from "../../../../common-src/TimeUtils";
import {getPublicBaseUrl} from "../../../common/ClientUrlUtils";
import AdminRadio from "../../../components/AdminRadio";
import {showToast} from "../../../common/ToastUtils";
import {unescapeHtml} from "../../../../common-src/StringUtils";
import ExternalLink from "../../../components/ExternalLink";
import EnclosureManager from "./components/MediaManager";
import {NAV_ITEMS, NAV_ITEMS_DICT, ITEM_STATUSES, ITEM_STATUSES_DICT} from "../../../../common-src/Constants";

const SUBMIT_STATUS__START = 1;

function initEpisode() {
  return ({
    pubDateMs: datetimeLocalToMs(new Date()),
    explicit: false,
  });
}

export default class EditEpisodeApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateEpisodeMeta = this.onUpdateEpisodeMeta.bind(this);
    this.onUpdateEpisodeToFeed = this.onUpdateEpisodeToFeed.bind(this);

    const $feedContent = document.getElementById('feed-content');
    const $dataParams = document.getElementById('lh-data-params');
    const itemId = $dataParams ? $dataParams.getAttribute('data-item-id') : null;
    const action = itemId ? 'edit' : 'create';
    const feed = JSON.parse(unescapeHtml($feedContent.innerHTML));
    if (!feed.episodes) {
      feed.episodes = {};
    }
    const item = feed.episodes[itemId] || initEpisode();
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

  onUpdateEpisodeMeta(attrDict, extraDict) {
    this.setState(prevState => ({item: {...prevState.item, ...attrDict,}, ...extraDict}));
  }

  onUpdateEpisodeToFeed(onSuccess) {
    let {item, itemId, feed} = this.state;
    const episodesBundle = {
      ...feed.episodes,
      [itemId]: {...item},
    };
    this.onUpdateFeed({'episodes': episodesBundle}, onSuccess);
  }

  onSubmit(e) {
    e.preventDefault();
    this.onUpdateEpisodeToFeed(() => {
      const {feed, itemId, action} = this.state;
      this.setState({submitStatus: SUBMIT_STATUS__START});
      Requests.post(ADMIN_URLS.ajaxFeed(), feed)
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
            }, 3000);
          }
        });
    });
  }

  render() {
    const {submitStatus, itemId, item, action} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const {mediaFile} = item;
    const status = item.status || ITEM_STATUSES.PUBLISHED;

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
            <EnclosureManager
              mediaFile={mediaFile}
              onMediaFileUpdated={(newMediaFile) => {
                this.onUpdateEpisodeMeta({
                  mediaFile: {
                    ...mediaFile,
                    ...newMediaFile,
                  },
                });
              }}
            />
          </div>
          <div className="lh-page-card">
            <h2 className="lh-page-title">Episode metadata</h2>
            <div className="flex">
              <div>
                <AdminImageUploaderApp
                  mediaType="eps"
                  currentImageUrl={item.image}
                  onImageUploaded={(cdnUrl) => this.onUpdateEpisodeMeta({'image': cdnUrl})}
                />
              </div>
              <div className="ml-8 flex-1 grid grid-cols-1 gap-4">
                <AdminInput
                  label="Episode title"
                  value={item.title}
                  onChange={(e) => {
                    const attrDict = {'title': e.target.value};
                    if (action !== 'edit' && !this.state.userChangedLink) {
                      attrDict.link = PUBLIC_URLS.itemWeb(itemId, item.title, getPublicBaseUrl());
                    }
                    this.onUpdateEpisodeMeta(attrDict);
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
                  <AdminDatetimePicker
                    label="Published date"
                    value={item.pubDateMs}
                    onChange={(e) => {
                      this.onUpdateEpisodeMeta({'pubDateMs': datetimeLocalStringToMs(e.target.value)});
                    }}
                  />
                  <AdminInput
                    label="Link"
                    value={item.link}
                    onChange={(e) => this.onUpdateEpisodeMeta({'link': e.target.value}, {userChangedLink: true})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <AdminRadio
                    label="Explicit"
                    groupName="lh-explicit"
                    buttons={[{
                      'name': 'Yes',
                      'checked': item.explicit,
                    }, {
                      'name': 'No',
                      'checked': !item.explicit,
                    }]}
                    value={item.explicit}
                    onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value === 'Yes'})}
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <AdminTextarea
                label="Episode description"
                value={item.description}
                onChange={(e) => this.onUpdateEpisodeMeta({'description': e.target.value})}
              />
            </div>
            <div className="mt-8 pt-8 border-t grid grid-cols-1 gap-4">
              <div className="grid grid-cols-3 gap-4">
                <AdminInput
                  label="<itunes:episodeType>"
                  value=""
                  onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value})}
                />
                <AdminInput
                  label="<itunes:season>"
                  value=""
                  onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value})}
                />
                <AdminInput
                  label="<itunes:episode>"
                  value=""
                  onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminInput
                  label="<itunes:block>"
                  value=""
                  onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value})}
                />
                <AdminInput
                  label="<guid>"
                  value=""
                  onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value})}
                />
                <AdminInput
                  label="<itunes:title>"
                  value=""
                  onChange={(e) => this.onUpdateEpisodeMeta({'explicit': e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="sticky top-8">
            <div className="lh-page-card text-center">
              <div className="mb-4">
                <AdminRadio
                  groupName="item-status"
                  buttons={[
                    {
                      name: ITEM_STATUSES_DICT[ITEM_STATUSES.PUBLISHED].name,
                      value: ITEM_STATUSES.PUBLISHED,
                      checked: status === ITEM_STATUSES.PUBLISHED,
                    },
                    {
                      name: ITEM_STATUSES_DICT[ITEM_STATUSES.UNPUBLISHED].name,
                      value: ITEM_STATUSES.UNPUBLISHED,
                      checked: status === ITEM_STATUSES.UNPUBLISHED,
                    }]}
                  onChange={(e) => {
                    this.onUpdateEpisodeMeta({'status': e.target.value})
                  }}
                />
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
            {action === 'edit' && <div className="lh-page-card mt-4 flex justify-center">
              <ExternalLink url={PUBLIC_URLS.itemWeb(itemId, item.title)} text="Item Web"/>
            </div>}
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
