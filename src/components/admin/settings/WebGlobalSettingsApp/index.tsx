import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminImageUploaderApp from "@/components/admin/shared/AdminImageUploaderApp";
import AdminInput from "@/components/admin/shared/AdminInput";
import {
  SETTINGS_CATEGORIES,
  DEFAULT_ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
} from "@/shared/Constants";
import {
  ITEM_ORDERS,
  ITEM_SORTS,
  type ItemOrder,
  type ItemSort,
  resolveItemPaginationSettings,
} from "@/shared/ItemPagination";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
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
    let itemsOrder: ItemOrder = ITEM_ORDERS.DESC;
    let itemsSort: ItemSort = ITEM_SORTS.PUBLISHED_AT;
    if (feed.settings && feed.settings[currentType]) {
      favicon = feed.settings[currentType].favicon || {};
      publicBucketUrl = feed.settings[currentType].publicBucketUrl || '/media/';
      ({itemsOrder, itemsSort} = resolveItemPaginationSettings(
        feed.settings[currentType],
      ));
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
      itemsOrder,
      itemsSort,
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
      itemsOrder,
      itemsSort,
    } = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    return (<SettingsBase
      title="Global settings"
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
          itemsOrder,
          itemsSort,
          itemsPerPage,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        <details open>
          <summary className="mb-2 cursor-pointer font-semibold text-foreground">R2 public bucket url</summary>
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
          <summary className="mb-2 cursor-pointer font-semibold text-foreground">Items settings</summary>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
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
            <div className="contents">
              <AdminRadioGroup
                labelComponent={<ExplainText
                  bundle={CONTROLS_TEXTS_DICT[SETTINGS_CONTROLS.ITEMS_SORT_ORDER]}
                  customClass="m-input-label-small"
                />}
                name="items-sort"
                value={itemsSort}
                options={[{
                  label: 'Published at',
                  value: ITEM_SORTS.PUBLISHED_AT,
                }, {
                  label: 'Created at',
                  value: ITEM_SORTS.CREATED_AT,
                }, {
                  label: 'Updated at',
                  value: ITEM_SORTS.UPDATED_AT,
                }]}
                onValueChange={(value) => this.setState({itemsSort: value}, () => setChanged())}
              />
              <AdminRadioGroup
                label="Order"
                labelClassName="m-input-label-small"
                name="items-order"
                value={itemsOrder}
                options={[{
                  label: 'Newest first',
                  value: ITEM_ORDERS.DESC,
                }, {
                  label: 'Oldest first',
                  value: ITEM_ORDERS.ASC,
                }]}
                onValueChange={(value) => this.setState({itemsOrder: value}, () => setChanged())}
              />
            </div>
          </div>
        </details>
        <details>
          <summary className="mb-2 cursor-pointer font-semibold text-foreground">Favicon</summary>
          <div className="flex">
            <AdminImageUploaderApp
              feed={feed}
              mediaStorage={this.props.mediaStorage}
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
