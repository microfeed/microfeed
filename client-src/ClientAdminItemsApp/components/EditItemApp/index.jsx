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
import {isChineseLanguage} from "../../../../common-src/I18n";

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
    }), () => onSuccess());
  }

  onUpdateItemMeta(attrDict, extraDict) {
    this.setState(prevState => ({
      changed: true,
      item: {...prevState.item, ...attrDict},
      ...extraDict,
    }));
  }

  onUpdateItemToFeed(onSuccess) {
    const {item, itemId, feed} = this.state;
    const itemsBundle = {
      ...feed.items,
      [itemId]: {...item},
    };
    this.onUpdateFeed({items: itemsBundle}, onSuccess);
  }

  onDelete() {
    const {item} = this.state;
    const isZh = isChineseLanguage(this.state.feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {item: {...item, status: STATUSES.DELETED}})
      .then(() => {
        showToast(t('删除成功！', 'Deleted!'), 'success');
        this.setState({submitStatus: null, changed: false}, () => {
          setTimeout(() => {
            location.href = ADMIN_URLS.allItems();
          }, 1000);
        });
      })
      .catch((error) => {
        this.setState({submitStatus: null}, () => {
          if (!error.response) {
            showToast(t('网络错误，请刷新页面后重试。', 'Network error. Please refresh the page and try again.'), 'error');
          } else {
            showToast(t('操作失败，请重试。', 'Failed. Please try again.'), 'error');
          }
        });
      });
  }

  onSubmit(e) {
    e.preventDefault();
    const isZh = isChineseLanguage(this.state.feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;
    const {item, itemId, action} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {item: {id: itemId, ...item}})
      .then(() => {
        this.setState({submitStatus: null, changed: false}, () => {
          if (action === 'edit') {
            showToast(t('更新成功！', 'Updated!'), 'success');
          } else {
            showToast(t('创建成功！', 'Created!'), 'success');
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
          showToast(t('网络错误，请刷新页面后重试。', 'Network error. Please refresh the page and try again.'), 'error');
        } else {
          showToast(t('操作失败，请重试。', 'Failed. Please try again.'), 'error');
        }
      });
    });
  }

  render() {
    const {submitStatus, itemId, item, action, feed, onboardingResult, changed} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const {mediaFile} = item;
    const status = item.status || STATUSES.PUBLISHED;
    const isZh = isChineseLanguage(feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;

    const webGlobalSettings = feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';

    let buttonText = t('创建', 'Create');
    let submittingButtonText = t('创建中...', 'Creating...');
    let currentPage = NAV_ITEMS.NEW_ITEM;
    let upperLevel;
    if (action === 'edit') {
      buttonText = t('更新', 'Update');
      submittingButtonText = t('更新中...', 'Updating...');
      currentPage = NAV_ITEMS.ALL_ITEMS;
      upperLevel = {
        name: isZh ? (NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].labelZh || NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name) : NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name,
        url: ADMIN_URLS.allItems(),
        childName: t(`内容（ID = ${itemId}）`, `Item (id = ${itemId})`),
      };
    }

    return (<AdminNavApp
      currentPage={currentPage}
      upperLevel={upperLevel}
      onboardingResult={onboardingResult}
      language={feed.channel.language}
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
                  onImageUploaded={(cdnUrl) => this.onUpdateItemMeta({image: cdnUrl})}
                />
              </div>
              <div className="ml-8 flex-1">
                <AdminInput
                  labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.TITLE]}/>}
                  value={item.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const attrDict = {title};
                    if (action !== 'edit' && !this.state.userChangedLink) {
                      attrDict.link = PUBLIC_URLS.webItem(itemId, title, getPublicBaseUrl());
                    }
                    this.onUpdateItemMeta(attrDict);
                  }}
                />
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <AdminDatetimePicker
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.PUB_DATE]}/>}
                    value={item.pubDateMs}
                    onChange={(e) => {
                      this.onUpdateItemMeta({pubDateMs: datetimeLocalStringToMs(e.target.value)});
                    }}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.LINK]}/>}
                    value={item.link}
                    onChange={(e) => this.onUpdateItemMeta({link: e.target.value}, {userChangedLink: true})}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <AdminRadio
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.STATUS]}/>}
                    groupName="item-status"
                    buttons={[
                      {
                        name: isZh ? ITEM_STATUSES_DICT[STATUSES.PUBLISHED].labelZh : ITEM_STATUSES_DICT[STATUSES.PUBLISHED].name,
                        value: STATUSES.PUBLISHED,
                        checked: status === STATUSES.PUBLISHED,
                      },
                      {
                        name: isZh ? ITEM_STATUSES_DICT[STATUSES.UNLISTED].labelZh : ITEM_STATUSES_DICT[STATUSES.UNLISTED].name,
                        value: STATUSES.UNLISTED,
                        checked: status === STATUSES.UNLISTED,
                      },
                      {
                        name: isZh ? ITEM_STATUSES_DICT[STATUSES.UNPUBLISHED].labelZh : ITEM_STATUSES_DICT[STATUSES.UNPUBLISHED].name,
                        value: STATUSES.UNPUBLISHED,
                        checked: status === STATUSES.UNPUBLISHED,
                      }]}
                    onChange={(e) => {
                      this.onUpdateItemMeta({status: parseInt(e.target.value, 10)});
                    }}
                  />
                  <div className="text-muted-color text-xs" dangerouslySetInnerHTML={{__html: isZh ? ITEM_STATUSES_DICT[status].descriptionZh : ITEM_STATUSES_DICT[status].description}} />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <AdminRichEditor
                labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.DESCRIPTION]}/>}
                value={item.description}
                onChange={(value) => this.onUpdateItemMeta({description: value})}
                extra={{
                  publicBucketUrl,
                  folderName: `items/${itemId}`,
                }}
              />
            </div>
          </div>
          <div className="lh-page-card">
            <details>
              <summary className="m-page-summary">{t('播客专用字段', 'Podcast-specific fields')}</summary>
              <div className="grid grid-cols-1 gap-8">
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <AdminRadio
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.ITUNES_EXPLICIT]}/>}
                    groupName="lh-explicit"
                    buttons={[{
                      name: t('是', 'yes'),
                      checked: item['itunes:explicit'],
                    }, {
                      name: t('否', 'no'),
                      checked: !item['itunes:explicit'],
                    }]}
                    value={item['itunes:explicit']}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:explicit': e.target.value === t('是', 'yes')})}
                  />
                  <AdminInput
                    labelComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[ITEM_CONTROLS.GUID]}/>}
                    value={item.guid || itemId}
                    setRef={(ref) => {
                      if (!item.guid && ref) {
                        this.onUpdateItemMeta({guid: ref.value}, {changed: false});
                      }
                    }}
                    onChange={(e) => this.onUpdateItemMeta({guid: e.target.value})}
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
                      name: t('完整内容', 'full'),
                      checked: item['itunes:episodeType'] === 'full',
                    }, {
                      name: t('预告', 'trailer'),
                      checked: item['itunes:episodeType'] === 'trailer',
                    }, {
                      name: t('加更', 'bonus'),
                      checked: item['itunes:episodeType'] === 'bonus',
                    }]}
                    value={item['itunes:episodeType']}
                    onChange={(e) => {
                      const valueMap = {[t('完整内容', 'full')]: 'full', [t('预告', 'trailer')]: 'trailer', [t('加更', 'bonus')]: 'bonus'};
                      this.onUpdateItemMeta({'itunes:episodeType': valueMap[e.target.value]});
                    }}
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
                      name: t('是', 'yes'),
                      checked: item['itunes:block'],
                    }, {
                      name: t('否', 'no'),
                      checked: !item['itunes:block'],
                    }]}
                    value={item['itunes:block']}
                    onChange={(e) => this.onUpdateItemMeta({'itunes:block': e.target.value === t('是', 'yes')})}
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
                  <SideQuickLink url={PUBLIC_URLS.webItem(itemId, item.title)} text={t('网页条目', 'web item')}/>
                  <SideQuickLink url={PUBLIC_URLS.jsonItem(itemId)} text={t('JSON 条目', 'json item')}/>
                </div>}
              />
              <div className="lh-page-card mt-4 flex justify-center">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const ok = confirm(t('确定要永久删除这条内容吗？', 'Are you going to permanently delete this item?'));
                    if (ok) {
                      this.onDelete();
                    }
                  }
                }><div className="flex items-center text-red-500 text-sm hover:text-brand-light">
                  <TrashIcon className="w-4" />
                  <div className="ml-1">{t('删除这条内容', 'Delete this item')}</div>
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
