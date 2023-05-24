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
    return (<SettingsBase
      title="Web global settings"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        if (publicBucketUrl) {
          if (!isValidUrl(publicBucketUrl)) {
            showToast('Invalid url. A valid url should start with http:// or https://, ' +
              'for example, https://media-cdn.microfeed.org',
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
          <summary className="lh-page-subtitle cursor-pointer">R2 public bucket url</summary>
          <AdminInput
            type="url"
            customClass="text-xs"
            value={publicBucketUrl}
            onChange={(e) => this.setState({publicBucketUrl: e.target.value}, () => setChanged())}
          />
        </details>
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">Items settings</summary>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <AdminInput
                label="Items per page"
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
                    showToast(`Items per page should be less than ${MAX_ITEMS_PER_PAGE}`, 'error', 5000)
                  } else if (newItemsPerPage < 0) {
                    showToast('Items per page should not be a negative number', 'error', 5000)
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
                  name: 'Newest first',
                  value: ITEMS_SORT_ORDERS.NEWEST_FIRST,
                  checked: itemsSortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST,
                }, {
                  name: 'Oldest first',
                  value: ITEMS_SORT_ORDERS.OLDEST_FIRST,
                  checked: itemsSortOrder === ITEMS_SORT_ORDERS.OLDEST_FIRST,
                }]}
                onChange={(e) => this.setState({itemsSortOrder: e.target.value}, () => setChanged())}
              />
            </div>
          </div>
        </details>
        <details>
          <summary className="lh-page-subtitle cursor-pointer">Favicon</summary>
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
                  return `Image too big: ${parseInt(width)} x ${parseInt(height)} pixels. ` +
                    "You'd better upload a smaller image for favicon.";
                } else if (width < 48 && height < 48) {
                  return `Image too small: ${parseInt(width)} x ${parseInt(height)} pixels. ` +
                    "You'd better upload a bigger image for favicon.";
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
