import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminCodeEditor from "../../../components/AdminCodeEditor";
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import AdminInput from "../../../components/AdminInput";
import {DEFAULT_ITEMS_PER_PAGE, ITEMS_SORT_ORDERS, MAX_ITEMS_PER_PAGE} from "../../../../common-src/Constants";
import AdminRadio from "../../../components/AdminRadio";
import {showToast} from "../../../common/ToastUtils";

export default class WebGlobalSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = 'webGlobalSettings';
    const {feed} = props;

    let headerCode = '';
    let footerCode = '';
    let favicon = '';
    let publicBucketUrl = '';
    let itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
    let itemsSortOrder = ITEMS_SORT_ORDERS.NEWEST_FIRST;
    if (feed.settings && feed.settings[currentType]) {
      headerCode = feed.settings[currentType].headerCode || '';
      footerCode = feed.settings[currentType].footerCode || '';
      favicon = feed.settings[currentType].favicon || {};
      publicBucketUrl = feed.settings[currentType].publicBucketUrl || '';
      itemsSortOrder = feed.settings[currentType].itemsSortOrder || ITEMS_SORT_ORDERS.NEWEST_FIRST;
      itemsPerPage = feed.settings[currentType].itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
    }
    this.state = {
      feed,

      headerCode,
      footerCode,
      currentType,
      favicon,
      publicBucketUrl,
      itemsPerPage,
      itemsSortOrder,
    };
  }

  render() {
    const {feed, currentType, headerCode, footerCode, favicon, publicBucketUrl, itemsPerPage, itemsSortOrder} = this.state;
    const {submitting, submitForType} = this.props;
    return (<SettingsBase
      title="Web global settings"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        this.props.onSubmit(e, currentType, {
          headerCode,
          footerCode,
          favicon,
          publicBucketUrl,
          itemsSortOrder,
          itemsPerPage,
        });
      }}
    >
      <details>
        <summary className="lh-page-subtitle cursor-pointer">R2 Public Bucket URL</summary>
        <AdminInput
          type="url"
          value={publicBucketUrl}
          onChange={(e) => this.setState({publicBucketUrl: e.target.value})}
        />
      </details>
      <details className="mt-4">
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
            })}
          />
        </div>
      </details>
      <details className="mt-4">
        <summary className="lh-page-subtitle cursor-pointer">Items Settings</summary>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <AdminInput
              label="Items per page"
              type="number"
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
                this.setState({itemsPerPage: newItemsPerPage})
              }}
            />
          </div>
          <div className="col-span-1">
            <AdminRadio
              label="Items sort order"
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
              onChange={(e) => this.setState({itemsSortOrder: e.target.value})}
            />
          </div>
        </div>
      </details>
      <details className="mt-4">
        <summary className="lh-page-subtitle cursor-pointer">Site Header</summary>
        <div className="text-xs text-muted-color mb-4">Code here will be placed right before the <b>{'</head>'}</b> tag on every public web page of the site.</div>
        <AdminCodeEditor
          code={headerCode}
          language="html"
          minHeight="30vh"
          onChange={(e) => this.setState({headerCode: e.target.value})}
        />
      </details>
      <details className="mt-4">
        <summary className="lh-page-subtitle cursor-pointer">Site Footer</summary>
        <div className="text-xs text-muted-color mb-4">
          Code here will be placed right before the <b>{'</body>'}</b> tag on every public web page of the site. You can put a Google Analytics tag or any 3rd-party js code here.
        </div>
        <AdminCodeEditor
          code={footerCode}
          minHeight="30vh"
          language="html"
          onChange={(e) => this.setState({footerCode: e.target.value})}
        />
      </details>
    </SettingsBase>);
  }
}
