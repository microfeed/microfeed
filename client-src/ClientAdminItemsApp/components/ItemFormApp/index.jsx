import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import TypePicker from '../TypePicker';
import SchemaItemEditor from '../SchemaItemEditor';
import {unescapeHtml, ADMIN_URLS} from '../../../../common-src/StringUtils';
import {NAV_ITEMS, NAV_ITEMS_DICT} from '../../../../common-src/Constants';

function readJsonScript(id) {
  const $el = document.getElementById(id);
  if (!$el) {
    return null;
  }
  try {
    return JSON.parse(unescapeHtml($el.innerHTML));
  } catch (error) {
    return null;
  }
}

export default class ItemFormApp extends React.Component {
  constructor(props) {
    super(props);

    const $dataParams = document.getElementById('lh-data-params');
    const itemId = $dataParams ? $dataParams.getAttribute('data-item-id') : null;
    const dataContentType = $dataParams ? $dataParams.getAttribute('data-content-type') : null;

    const feed = readJsonScript('feed-content') || {};
    const onboardingResult = readJsonScript('onboarding-result') || {requiredOk: true};

    const urlParams = new URLSearchParams(window.location.search);
    const typeFromUrl = urlParams.get('type');

    const action = itemId ? 'edit' : 'create';
    const item = action === 'edit' ? feed.item : null;
    const contentType = action === 'edit' ? (dataContentType || (item && item.content_type)) : typeFromUrl;

    const webGlobalSettings = (feed.settings && feed.settings.webGlobalSettings) || {};

    this.state = {
      action,
      itemId,
      item,
      contentType,
      onboardingResult,
      publicBucketUrl: webGlobalSettings.publicBucketUrl || '',
    };

    this.onPickType = this.onPickType.bind(this);
  }

  onPickType(typeName) {
    this.setState({contentType: typeName});
  }

  render() {
    const {action, item, contentType, onboardingResult, publicBucketUrl} = this.state;

    let currentPage = NAV_ITEMS.NEW_ITEM;
    let upperLevel;
    if (action === 'edit') {
      currentPage = NAV_ITEMS.ALL_ITEMS;
      upperLevel = {
        name: NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name,
        url: ADMIN_URLS.allItems(),
        childName: `Item (id = ${item ? item.id : ''})`,
      };
    }

    return (
      <AdminNavApp
        currentPage={currentPage}
        upperLevel={upperLevel}
        onboardingResult={onboardingResult}
      >
        {contentType
          ? (
            <SchemaItemEditor
              contentType={contentType}
              item={action === 'edit' ? item : undefined}
              publicBucketUrl={publicBucketUrl}
            />
          )
          : <TypePicker onPick={this.onPickType} />}
      </AdminNavApp>
    );
  }
}
