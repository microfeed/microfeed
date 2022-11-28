import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS, PUBLIC_URLS, escapeHtml, unescapeHtml} from "../../../../common-src/StringUtils";
import {showToast} from "../../../common/ToastUtils";
import Requests from "../../../common/requests";
import clsx from "clsx";
import ExternalLink from "../../../components/ExternalLink";
import AdminCodeEditor from "../../../components/AdminCodeEditor";
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";

const SUBMIT_STATUS__START = 1;

function TabButton({name, onClick, selected}) {
  return (<a
    href="#"
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={clsx('py-2 px-3', selected ?
      'bg-helper-color text-white hover:text-white' : '')}
  >
    {name}
  </a>);
}

function CodeTabs({codeType, setState, themeName}) {
  return (<div className="lh-page-card mb-4">
    {themeName !== 'global' && <TabButton
      name="Web Feed"
      selected={codeType === 'webFeed'}
      onClick={() => setState({codeType: 'webFeed'})}
    />}
    {themeName !== 'global' && <TabButton
      name="Web Item"
      selected={codeType === 'webItem'}
      onClick={() => setState({codeType: 'webItem'})}
    />}
    <TabButton
      name="Web Header"
      selected={codeType === 'webHeader'}
      onClick={() => setState({codeType: 'webHeader'})}
    />
    <TabButton
      name="Web Body Start"
      selected={codeType === 'webBodyStart'}
      onClick={() => setState({codeType: 'webBodyStart'})}
    />
    <TabButton
      name="Web Body End"
      selected={codeType === 'webBodyEnd'}
      onClick={() => setState({codeType: 'webBodyEnd'})}
    />
    {themeName !== 'global' && <TabButton
      name="RSS Stylesheet"
      selected={codeType === 'rssStylesheet'}
      onClick={() => setState({codeType: 'rssStylesheet'})}
    />}
  </div>);
}

function getFirstItemUrl(feed) {
  const {items} = feed;
  if (items && Object.keys(items).length > 0) {
    const itemId = Object.keys(items)[0];
    const item = items[itemId];
    return PUBLIC_URLS.webItem(itemId, item.title || 'Untitled');
  }
  return '/'
}

export default class CustomCodeEditorApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.setState = this.setState.bind(this);

    const themeTmplJson = JSON.parse(unescapeHtml(document.getElementById('theme-tmpl-json').innerHTML));
    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));

    const {
      themeName,
      rssStylesheet,
      webItem,
      webFeed,
      webBodyStart,
      webBodyEnd,
      webHeader,
    } = themeTmplJson;

    this.state = {
      codeType: themeName !== 'global' ? 'webFeed' : 'webHeader',
      submitStatus: null,

      themeName,
      rssStylesheet,
      webItem,
      webFeed,
      webBodyStart,
      webBodyEnd,
      webHeader,

      feed,
    };
  }

  onUpdateFeed(themeName, themeTmpls, onSucceed) {
    const existingStyles = this.state.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE] || {};
    const existingThemes = existingStyles.themes || {};

    let customCode = {
      // TODO: if we support multiple themes, then don't set currentTheme here.
      currentTheme: themeName,
      themes: {
        ...existingThemes,
        [themeName]: {
          ...themeTmpls,
        }
      },
    };
    if (themeName === 'global') {
      customCode = {
        ...themeTmpls,
      };
    }
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        settings: {
          ...prevState.feed.settings,
          [SETTINGS_CATEGORIES.CUSTOM_CODE]: {
            ...prevState.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE],
            ...customCode,
          },
        }
      },
    }), () => onSucceed())
  }

  onSubmit(e) {
    e.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});

    const {themeName} = this.state;
    const {
      rssStylesheet,
      webItem,
      webFeed,
      webBodyStart,
      webBodyEnd,
      webHeader,
    } = this.state;

    const themeTmpls = {
      webBodyStart,
      webBodyEnd,
      webHeader,
    };

    if (themeName !== 'global') {
      themeTmpls['rssStylesheet'] = rssStylesheet;
      themeTmpls['webItem'] = webItem;
      themeTmpls['webFeed'] = webFeed;
    }
    this.onUpdateFeed(themeName, themeTmpls, () => {
      Requests.post('/admin/ajax/feed/', {settings: {
        [SETTINGS_CATEGORIES.CUSTOM_CODE]: this.state.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]}})
        .then(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Updated!', 'success');
          });
        })
        .catch(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Failed to update. Please try again.', 'error')});
        });
    });
  }

  render() {
    const {codeType, submitStatus, feed, themeName} = this.state;
    const code = this.state[codeType];
    let language = 'html';
    let viewUrl = '/';
    let description;
    switch(codeType) {
      case 'rssStylesheet':
        viewUrl = PUBLIC_URLS.rssFeed();
        language = 'css';
        description = <div>The code is used for <a href={PUBLIC_URLS.rssFeedStylesheet()} target="_blank">
          {PUBLIC_URLS.rssFeedStylesheet()}</a>, which is included in <a
          href={PUBLIC_URLS.rssFeed()} target="_blank">the RSS feed</a>.</div>;
        break;
      case 'webItem':
        viewUrl = getFirstItemUrl(feed);
        description = <div>The code is used for an item web page, which is good for SEO.</div>;
        break;
      case 'webFeed':
        viewUrl = PUBLIC_URLS.webFeed();
        description = <div>The code is used for <a href={PUBLIC_URLS.webFeed()} target="_blank">the public homepage of this site</a></div>;
        break;
      case 'webHeader':
        viewUrl = PUBLIC_URLS.webFeed();
        description = <div>The code is inserted right before the <span
          dangerouslySetInnerHTML={{__html: escapeHtml('</head>')}} /> tag. You can put custom css or javascript code here.</div>
        break;
      case 'webBodyEnd':
        viewUrl = PUBLIC_URLS.webFeed();
        description = <div>The code is inserted right before the <span
          dangerouslySetInnerHTML={{__html: escapeHtml('</body>')}} /> tag. You can put links / footer / copyright here.</div>
        break;
      case 'webBodyStart':
        viewUrl = PUBLIC_URLS.webFeed();
        description = <div>The code is inserted right after the <span
          dangerouslySetInnerHTML={{__html: escapeHtml('<body>')}} /> tag. You can put navigation menus / branding things here.</div>
        break;
      default:
        break;
    }
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp
      currentPage="settings"
      upperLevel={{name: 'Settings', url: ADMIN_URLS.settings(), childName: 'Code Editor'}}
    >
      <CodeTabs codeType={codeType} setState={this.setState} themeName={themeName} />
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="text-xs text-muted-color mb-4">{description}</div>
          <AdminCodeEditor
            code={code}
            language={language}
            onChange={(e) => this.setState({[codeType]: e.target.value})}
          />
        </div>
        <div className="col-span-3">
          <div className="sticky top-8">
            <div className="text-center lh-page-card">
              <button
                type="submit"
                className="lh-btn lh-btn-brand-dark lh-btn-lg"
                onClick={this.onSubmit}
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update'}
              </button>
            </div>
            <div className="lh-page-card mt-4 flex flex-col items-center">
              <ExternalLink url={viewUrl} text="View live page"/>
              <div className="text-muted-color text-xs">{viewUrl}</div>
            </div>
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
