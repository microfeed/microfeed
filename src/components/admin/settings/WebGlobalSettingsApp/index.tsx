import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminImageUploaderApp from "@/components/admin/shared/AdminImageUploaderApp";
import AdminInput from "@/components/admin/shared/AdminInput";
import {
  SETTINGS_CATEGORIES,
  DEFAULT_ITEMS_PER_PAGE,
  ITEMS_SORT_ORDERS,
  MAX_ITEMS_PER_PAGE,
} from "@/shared/Constants";
import AdminRadio from "@/components/admin/shared/AdminRadio";
import {showToast} from "@/client/ToastUtils";
import ExplainText from "@/components/admin/shared/ExplainText";
import {CONTROLS_TEXTS_DICT, SETTINGS_CONTROLS} from "../FormExplainTexts";
import {
  isLocalDevelopmentHostname,
  isValidPublicBucketUrl,
  normalizePublicBucketUrl,
  resolvePublicBucketUrl,
} from "@/shared/StringUtils";

export default class WebGlobalSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    const currentType = SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS;
    const {feed} = props;

    let favicon = '';
    let publicBucketUrl = '';
    let itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
    let itemsSortOrder = ITEMS_SORT_ORDERS.NEWEST_FIRST;
    if (feed.settings && feed.settings[currentType]) {
      favicon = feed.settings[currentType].favicon || {};
      publicBucketUrl = feed.settings[currentType].publicBucketUrl || '/media/';
      itemsSortOrder = feed.settings[currentType].itemsSortOrder || ITEMS_SORT_ORDERS.NEWEST_FIRST;
      itemsPerPage = feed.settings[currentType].itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
    }
    const isLocalDevelopment = isLocalDevelopmentHostname(
      window.location.hostname,
    );
    publicBucketUrl = resolvePublicBucketUrl(
      publicBucketUrl,
      window.location.hostname,
    );
    this.state = {
      feed,

      currentType,
      favicon,
      isLocalDevelopment,
      publicBucketUrl,
      itemsPerPage,
      itemsSortOrder,
    };
  }

  render() {
    const {
      feed,
      currentType,
      favicon,
      isLocalDevelopment,
      publicBucketUrl,
      itemsPerPage,
      itemsSortOrder,
    } = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    return (<SettingsBase
      title="Web global settings"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e: any) => {
        const normalizedPublicBucketUrl =
          normalizePublicBucketUrl(publicBucketUrl);
        if (
          normalizedPublicBucketUrl &&
          !isValidPublicBucketUrl(normalizedPublicBucketUrl)
        ) {
          showToast(
            'Invalid URL. Use /media/ or a complete URL starting with http:// or https://, ' +
              'for example, https://media.example.com/',
            'error',
            5000,
          );
          return;
        }
        this.props.onSubmit(e, currentType, {
          favicon,
          publicBucketUrl: normalizedPublicBucketUrl,
          itemsSortOrder,
          itemsPerPage,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">R2 public bucket url</summary>
          <AdminInput
            type="text"
            customClass="text-xs"
            disabled={isLocalDevelopment}
            extraParams={{
              inputMode: 'url',
              spellCheck: false,
            }}
            value={publicBucketUrl}
            onChange={(e: any) => this.setState({publicBucketUrl: e.target.value}, () => setChanged())}
          />
          <p className="mt-2 text-xs text-helper-color">
            {isLocalDevelopment
              ? 'Local development always serves uploaded files through /media/, backed by the local R2 binding.'
              : <>
                Keep <code>/media/</code> to serve uploaded files through this
                Worker. Optionally,{' '}
                <a
                  className="underline"
                  href="https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  connect a custom domain to your R2 bucket
                </a>
                {' '}and enter its complete URL here, such as{' '}
                <code>https://media.example.com/</code>.
              </>}
          </p>
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
                onChange={(e: any) => {
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
                onChange={(e: any) => this.setState({itemsSortOrder: e.target.value}, () => setChanged())}
              />
            </div>
          </div>
        </details>
        <details>
          <summary className="lh-page-subtitle cursor-pointer">Favicon</summary>
          <div className="flex">
            <AdminImageUploaderApp
              feed={feed}
              mediaStorageReady={this.props.mediaStorageReady}
              mediaType="favicon"
              publicBucketUrl={publicBucketUrl}
              currentImageUrl={favicon.url}
              imageSizeNotOkayFunc={(width: any, height: any) => {
                return (width > 256 && height > 256) || (width < 48 && height < 48);
              }}
              imageSizeNotOkayMsgFunc={(width: any, height: any) => {
                if (width > 256 && height > 256) {
                  return `Image too big: ${parseInt(width)} x ${parseInt(height)} pixels. ` +
                    "You'd better upload a smaller image for favicon.";
                } else if (width < 48 && height < 48) {
                  return `Image too small: ${parseInt(width)} x ${parseInt(height)} pixels. ` +
                    "You'd better upload a bigger image for favicon.";
                }
                return '';
              }}
              onImageUploaded={(cdnUrl: any, contentType: any) => this.setState({
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
