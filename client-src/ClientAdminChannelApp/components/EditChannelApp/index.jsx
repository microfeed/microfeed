import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminImageUploaderApp from '../../../components/AdminImageUploaderApp';
import AdminInput from "../../../components/AdminInput";
import AdminRadio from "../../../components/AdminRadio";
import {getPublicBaseUrl} from "../../../common/ClientUrlUtils";
import {unescapeHtml} from '../../../../common-src/StringUtils';
import {showToast} from "../../../common/ToastUtils";
import {AdminSideQuickLinks} from "../../../components/AdminSideQuickLinks";
import AdminRichEditor from "../../../components/AdminRichEditor";

const SUBMIT_STATUS__START = 1;

function initChannel() {
  return {
    link: getPublicBaseUrl(),
    language: 'en-us',
    explicit: false,
    category: [],
  };
}

export default class EditChannelApp extends React.Component {
  constructor(props) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateChannelMeta = this.onUpdateChannelMeta.bind(this);
    this.onUpdateChannelMetaToFeed = this.onUpdateChannelMetaToFeed.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const channel = feed.channel || initChannel();
    this.state = {
      feed,
      channel,
      submitStatus: null,
    }
  }

  onUpdateFeed(props, onSucceed) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        channel: {
          ...prevState.channel,
          ...props,
        },
      },
    }), () => onSucceed())
  }

  onUpdateChannelMeta(keyName, value) {
    this.setState((prevState) => ({
      channel: {
        ...prevState.channel,
        [keyName]: value,
      },
    }));
  }

  onUpdateChannelMetaToFeed(onSucceed) {
    this.onUpdateFeed(this.state.channel, onSucceed);
  }

  onSubmit(e) {
    e.preventDefault();
    this.onUpdateChannelMetaToFeed(() => {
      const {feed} = this.state;
      this.setState({submitStatus: SUBMIT_STATUS__START});
      Requests.post('/admin/ajax/feed/', feed)
        .then(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Updated!', 'success');
          });
        })
        .catch(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Failed to update. Please try again.', 'error');
          });
        });
    });
  }

  render() {
    const {feed, submitStatus, channel} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="flex">
            <div className="flex-none">
              <AdminImageUploaderApp
                mediaType="channel"
                currentImageUrl={channel.image}
                onImageUploaded={(cdnUrl) => this.onUpdateChannelMeta('image', cdnUrl)}
              />
            </div>
            <div className="flex-1 ml-8 grid grid-cols-1 gap-3">
              <AdminInput
                label="Title"
                value={channel.title}
                onChange={(e) => this.onUpdateChannelMeta('title', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="Publisher"
                  value={channel.publisher}
                  onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
                />
                <AdminInput
                  label="Website"
                  value={channel.link}
                  onChange={(e) => this.onUpdateChannelMeta('link', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminInput
                  label="Category"
                  value={channel.category.join(',')}
                  onChange={(e) => this.onUpdateChannelMeta('category', e.target.value.split(','))}
                />
                <AdminInput
                  label="Language"
                  value={channel.language}
                  onChange={(e) => this.onUpdateChannelMeta('language', e.target.value)}
                />
                <AdminRadio
                  label="Explicit"
                  groupName="lh-explicit"
                  buttons={[{
                   'name': 'Yes',
                   'checked': channel.explicit,
                  }, {
                    'name': 'No',
                   'checked': !channel.explicit,
                  }]}
                  value={channel.explicit}
                  onChange={(e) => this.onUpdateChannelMeta('explicit', e.target.value === 'Yes')}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t">
            <AdminRichEditor
              label="Description"
              value={channel.description}
              onChange={(value) =>{
                this.onUpdateChannelMeta('description', value);
              }}
            />
          </div>
          <div className="mt-8 pt-8 border-t grid grid-cols-1 gap-4">
            <div className="grid grid-cols-3 gap-4">
              <AdminInput
                label="<itunes:type>"
                value={feed.publisher}
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<itunes:owner>"
                value=""
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<copyright>"
                value=""
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <AdminInput
                label="<itunes:new-feed-url>"
                value={feed.publisher}
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<itunes:block>"
                value=""
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<itunes:complete>"
                value=""
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <AdminInput
                label="<itunes:title>"
                value=""
                onChange={(e) => this.onUpdateChannelMeta('publisher', e.target.value)}
              />
            </div>
          </div>
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
            <AdminSideQuickLinks />
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}