import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS, PUBLIC_URLS, unescapeHtml} from "../../../../common-src/StringUtils";
import {showToast} from "../../../common/ToastUtils";

const SUBMIT_STATUS__START = 1;

const TMPL_TYPE__RSS_STYLESHEET = 1;

export default class RssStylingApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);

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
      currentType: TMPL_TYPE__RSS_STYLESHEET,
      submitStatus: null,

      rssStylesheet,
      episodeWeb,
      feedWeb,
      webFooter,
      webHeader,

      feed,
    };
  }

  onSubmit(e) {
    e.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});
    setTimeout(() => {
      this.setState({submitStatus: null}, () => {
        showToast('Updated!', 'success');
      });
    }, 2000);
  }

  render() {
    const {currentType, submitStatus} = this.state;
    let viewUrl;
    switch(currentType) {
      case TMPL_TYPE__RSS_STYLESHEET:
        viewUrl = PUBLIC_URLS.feedRss();
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
          todo
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
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
