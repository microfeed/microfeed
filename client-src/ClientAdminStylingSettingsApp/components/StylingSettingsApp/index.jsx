import React from 'react';
import CodeEditor from '@uiw/react-textarea-code-editor';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS, PUBLIC_URLS, unescapeHtml} from "../../../../common-src/StringUtils";
import {showToast} from "../../../common/ToastUtils";
import Requests from "../../../common/requests";

const SUBMIT_STATUS__START = 1;

export default class RssStylingApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);

    const themeTmplJson = JSON.parse(unescapeHtml(document.getElementById('theme-tmpl-json').innerHTML));
    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));

    const {
      rssStylesheet,
      episodeWeb,
      feedWeb,
      webFooter,
      webHeader,
    } = themeTmplJson;

    this.state = {
      currentType: 'rssStylesheet',
      submitStatus: null,

      rssStylesheet,
      episodeWeb,
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
      episodeWeb,
      feedWeb,
      webFooter,
      webHeader,
    } = this.state;
    this.onUpdateFeed(themeName, {
      rssStylesheet,
      episodeWeb,
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
    const {currentType, submitStatus} = this.state;
    const code = this.state[currentType];
    let language = 'html';
    let viewUrl = '/';
    switch(currentType) {
      case 'rssStylesheet':
        viewUrl = PUBLIC_URLS.feedRss();
        language = 'css';
        break;
      case 'episodeWeb':
        // TODO: check if there's episode, then get an first episode's url.
        break;
      default:
        break;
    }
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp
      currentPage="settings"
      upperLevel={{name: 'Settings', url: ADMIN_URLS.settings(), childName: 'Styling'}}
    >
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <CodeEditor
            value={code}
            language={language}
            placeholder="Please enter code here"
            onChange={(e) => this.setState({[currentType]: e.target.value})}
            // prefixCls="h-1/2"
            style={{
              height: '80vh',
              overflow: 'auto',
              fontSize: 12,
              backgroundColor: "#f5f5f5",
              fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
            }}
          />
        </div>
        <div className="col-span-3">
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
          <div className="text-center lh-page-card mt-4">
            <a className="mr-2" href={viewUrl} target="_blank">View live page</a>
            <div className="text-muted-color text-xs">{viewUrl}</div>
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
