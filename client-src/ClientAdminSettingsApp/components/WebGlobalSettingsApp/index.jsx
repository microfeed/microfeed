import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import AdminInput from "../../../components/AdminInput";
import {
  SETTINGS_CATEGORIES,
  DEFAULT_ITEMS_PER_PAGE,
  ITEMS_SORT_ORDERS,
  MAX_ITEMS_PER_PAGE,
} from "../../../../common-src/Constants";
import AdminRadio from "../../../components/AdminRadio";
import {showToast} from "../../../common/ToastUtils";
import ExplainText from "../../../components/ExplainText";
import {CONTROLS_TEXTS_DICT, SETTINGS_CONTROLS} from "../FormExplainTexts";
import {isValidUrl} from "../../../../common-src/StringUtils";
import {isChineseLanguage} from "../../../../common-src/I18n";

export default class WebGlobalSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS;
    const {feed} = props;

    let favicon = '';
    let publicBucketUrl = '';
    let itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
    let itemsSortOrder = ITEMS_SORT_ORDERS.NEWEST_FIRST;
    if (feed.settings && feed.settings[currentType]) {
      favicon = feed.settings[currentType].favicon || {};
      publicBucketUrl = feed.settings[currentType].publicBucketUrl || '';
      itemsSortOrder = feed.settings[currentType].itemsSortOrder || ITEMS_SORT_ORDERS.NEWEST_FIRST;
      itemsPerPage = feed.settings[currentType].itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
    }
    this.state = {
      feed,

      currentType,
      favicon,
      publicBucketUrl,
      itemsPerPage,
      itemsSortOrder,
    };
  }

  render() {
    const {feed, currentType, favicon, publicBucketUrl, itemsPerPage, itemsSortOrder} = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    const isZh = isChineseLanguage(feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;
    return (<SettingsBase
      title={t('网站全局设置', 'Web global settings')}
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        if (publicBucketUrl) {
          if (!isValidUrl(publicBucketUrl)) {
            showToast(t(
              'URL 无效。请填写以 http:// 或 https:// 开头的完整地址，例如：https://media-cdn.microfeed.org',
              'Invalid url. A valid url should start with http:// or https://, for example, https://media-cdn.microfeed.org'
            ),
              'error', 5000);
            return;
          }
        }
        this.props.onSubmit(e, currentType, {
          favicon,
          publicBucketUrl,
          itemsSortOrder,
          itemsPerPage,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">{t('R2 公共存储桶 URL', 'R2 public bucket url')}</summary>
          <AdminInput
            type="url"
            customClass="text-xs"
            value={publicBucketUrl}
            onChange={(e) => this.setState({publicBucketUrl: e.target.value}, () => setChanged())}
          />
        </details>
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">{t('内容列表设置', 'Items settings')}</summary>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <AdminInput
                label={t('每页内容数', 'Items per page')}
                type="number"
                customLabelClass="m-input-label-small"
                customClass="text-xs"
                extraParams={{
                  'min': 0,
                  'max': MAX_ITEMS_PER_PAGE,
                }}
                value={itemsPerPage}
                onChange={(e) => {
                  let newItemsPerPage = parseInt(e.target.value, 10);
                  if (newItemsPerPage > MAX_ITEMS_PER_PAGE) {
                    newItemsPerPage = MAX_ITEMS_PER_PAGE;
                    showToast(t(`每页内容数不能超过 ${MAX_ITEMS_PER_PAGE}`, `Items per page should be less than ${MAX_ITEMS_PER_PAGE}`), 'error', 5000)
                  } else if (newItemsPerPage < 0) {
                    showToast(t('每页内容数不能为负数', 'Items per page should not be a negative number'), 'error', 5000)
                  }
                  this.setState({itemsPerPage: newItemsPerPage}, () => setChanged())
                }}
              />
            </div>
            <div className="col-span-1">
              <AdminRadio
                customLabelClass="m-input-label-small"
                labelComponent={<ExplainText
                  bundle={CONTROLS_TEXTS_DICT[SETTINGS_CONTROLS.ITEMS_SORT_ORDER]}
                  customClass="m-input-label-small"
                />}
                groupName="items-sort-order"
                buttons={[{
                  name: t('最新优先', 'Newest first'),
                  value: ITEMS_SORT_ORDERS.NEWEST_FIRST,
                  checked: itemsSortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST,
                }, {
                  name: t('最早优先', 'Oldest first'),
                  value: ITEMS_SORT_ORDERS.OLDEST_FIRST,
                  checked: itemsSortOrder === ITEMS_SORT_ORDERS.OLDEST_FIRST,
                }]}
                onChange={(e) => this.setState({itemsSortOrder: e.target.value}, () => setChanged())}
              />
            </div>
          </div>
        </details>
        <details>
          <summary className="lh-page-subtitle cursor-pointer">{t('站点图标', 'Favicon')}</summary>
          <div className="flex">
            <AdminImageUploaderApp
              feed={feed}
              mediaType="favicon"
              currentImageUrl={favicon.url}
              imageSizeNotOkayFunc={(width, height) => {
                return (width > 256 && height > 256) || (width < 48 && height < 48);
              }}
              imageSizeNotOkayMsgFunc={(width, height) => {
                if (width > 256 && height > 256) {
                  return t(
                    `图片过大：${parseInt(width)} x ${parseInt(height)} 像素。建议上传更小的站点图标。`,
                    `Image too big: ${parseInt(width)} x ${parseInt(height)} pixels. You'd better upload a smaller image for favicon.`
                  );
                } else if (width < 48 && height < 48) {
                  return t(
                    `图片过小：${parseInt(width)} x ${parseInt(height)} 像素。建议上传更大的站点图标。`,
                    `Image too small: ${parseInt(width)} x ${parseInt(height)} pixels. You'd better upload a bigger image for favicon.`
                  );
                }
                return '';
              }}
              onImageUploaded={(cdnUrl, contentType) => this.setState({
                favicon: {
                  url: cdnUrl,
                  contentType,
                },
              }, () => setChanged())}
            />
          </div>
        </details>
      </div>
    </SettingsBase>);
  }
}
