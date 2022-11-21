import React from 'react';
import CodeEditor from '@uiw/react-textarea-code-editor';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS, PUBLIC_URLS, escapeHtml, unescapeHtml} from "../../../../common-src/StringUtils";
import {showToast} from "../../../common/ToastUtils";
import Requests from "../../../common/requests";
import clsx from "clsx";
import ExternalLink from "../../../components/ExternalLink";

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

function CodeTabs({currentType, setState}) {
  return (<div className="lh-page-card mb-4">
    <TabButton
      name="Web Feed"
      selected={currentType === 'feedWeb'}
      onClick={() => setState({currentType: 'feedWeb'})}
    />
    <TabButton
      name="Web Item"
      selected={currentType === 'itemWeb'}
      onClick={() => setState({currentType: 'itemWeb'})}
    />
    <TabButton
      name="Web Header"
      selected={currentType === 'webHeader'}
      onClick={() => setState({currentType: 'webHeader'})}
    />
    <TabButton
      name="Web Footer"
      selected={currentType === 'webFooter'}
      onClick={() => setState({currentType: 'webFooter'})}
    />
    <TabButton
      name="RSS Stylesheet"
      selected={currentType === 'rssStylesheet'}
      onClick={() => setState({currentType: 'rssStylesheet'})}
    />
  </div>);
}

function getFirstItemUrl(feed) {
  const {items} = feed;
  if (items && Object.keys(items).length > 0) {
    const itemId = Object.keys(items)[0];
    const item = items[itemId];
    return PUBLIC_URLS.itemWeb(itemId, item.title || 'Untitled');
  }
  return '/'
}

export default class RssStylingApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.setState = this.setState.bind(this);

    const themeTmplJson = JSON.parse(unescapeHtml(document.getElementById('theme-tmpl-json').innerHTML));
    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));

    const {
      rssStylesheet,
      itemWeb,
      feedWeb,
      webFooter,
      webHeader,
    } = themeTmplJson;

    this.state = {
      currentType: 'feedWeb',
      submitStatus: null,

      rssStylesheet,
      itemWeb,
      feedWeb,
      webFooter,
      webHeader,

      feed,
    };
  }

  onUpdateFeed(themeName, themeTmpls, onSucceed) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        settings: {
          ...prevState.feed.settings,
          styles: {
            // TODO: if we support multiple themes, then don't set currentTheme here.
            currentTheme: themeName,
            themes: {
              [themeName]: {
                ...themeTmpls,
              }
            },
          }
        }
      },
    }), () => onSucceed())
  }

  onSubmit(e) {
    e.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});

    // TODO: allow users to set theme name later
    const themeName = 'custom';
    const {
      rssStylesheet,
      itemWeb,
      feedWeb,
      webFooter,
      webHeader,
    } = this.state;
    this.onUpdateFeed(themeName, {
      rssStylesheet,
      itemWeb,
      feedWeb,
      webFooter,
      webHeader,
    }, () => {
      Requests.post('/admin/ajax/feed/', this.state.feed)
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
    const {currentType, submitStatus, feed} = this.state;
    const code = this.state[currentType];
    let language = 'html';
    let viewUrl = '/';
    let description;
    switch(currentType) {
      case 'rssStylesheet':
        viewUrl = PUBLIC_URLS.feedRss();
        language = 'css';
        description = <div>The code is used for <a href={PUBLIC_URLS.feedRssStylesheet()} target="_blank">
          {PUBLIC_URLS.feedRssStylesheet()}</a>, which is included in <a
          href={PUBLIC_URLS.feedRss()} target="_blank">the RSS feed</a>.</div>;
        break;
      case 'itemWeb':
        viewUrl = getFirstItemUrl(feed);
        description = <div>The code is used for an item web page, which is good for SEO.</div>;
        break;
      case 'feedWeb':
        viewUrl = PUBLIC_URLS.feedWeb();
        description = <div>The code is used for <a href={PUBLIC_URLS.feedWeb()} target="_blank">the public homepage of this site</a></div>;
        break;
      case 'webHeader':
        viewUrl = PUBLIC_URLS.feedWeb();
        description = <div>The code is inserted right before the <span
          dangerouslySetInnerHTML={{__html: escapeHtml('</head>')}} /> tag. You can put custom css or javascript code here.</div>
        break;
      case 'webFooter':
        viewUrl = PUBLIC_URLS.feedWeb();
        description = <div>The code is inserted right before the <span
          dangerouslySetInnerHTML={{__html: escapeHtml('</body>')}} /> tag. You can put links / footer / copyright here.</div>
        break;
      default:
        break;
    }
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp
      currentPage="settings"
      upperLevel={{name: 'Settings', url: ADMIN_URLS.settings(), childName: 'Styling'}}
    >
      <CodeTabs currentType={currentType} setState={this.setState} />
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="text-xs text-muted-color mb-4">{description}</div>
          <CodeEditor
            value={code}
            language={language}
            placeholder="Please enter code here"
            onChange={(e) => this.setState({[currentType]: e.target.value})}
            // prefixCls="h-1/2"
            style={{
              minHeight: '50vh',
              overflow: 'auto',
              fontSize: 12,
              backgroundColor: "#f5f5f5",
              fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
            }}
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
