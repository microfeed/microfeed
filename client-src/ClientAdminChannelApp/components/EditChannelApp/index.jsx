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
import AdminSelect from "../../../components/AdminSelect";
import {LANGUAGE_CODES_LIST} from "../../../../common-src/Constants";

const SUBMIT_STATUS__START = 1;

const LANGUAGE_CODES_DICT = {};
const LANGUAGE_CODES_SELECT_OPTIONS = [];
LANGUAGE_CODES_LIST.forEach((lc) => {
  LANGUAGE_CODES_DICT[lc.code] = {
    code: lc.code,
    value: `${lc.name} ${lc.code}`,
    label: <div>
      <div>{lc.name}</div>
      <div className="text-muted-color text-sm">{lc.code}</div>
    </div>,
  };
  LANGUAGE_CODES_SELECT_OPTIONS.push(LANGUAGE_CODES_DICT[lc.code]);
});

function initChannel() {
  return {
    link: getPublicBaseUrl(),
    language: 'en-us',
    category: [],
    image: '/assets/default/channel_image.png',
    'itunes:explicit': false,
    'itunes:type': 'episodic',
    'itunes:complete': false,
    'itunes:block': false,
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
    const {submitStatus, channel} = this.state;
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
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="Category"
                  value={channel.category.join(',')}
                  onChange={(e) => this.onUpdateChannelMeta('category', e.target.value.split(','))}
                />
                <AdminSelect
                  value={LANGUAGE_CODES_DICT[channel.language]}
                  label="Language"
                  options={LANGUAGE_CODES_SELECT_OPTIONS}
                  onChange={(selected) => {
                    this.onUpdateChannelMeta('language', selected.code);
                  }}
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
          <div className="mt-8 pt-8 border-t grid grid-cols-1 gap-8">
            <div className="grid grid-cols-4 gap-4">
              <AdminRadio
                label="<itunes:type>"
                groupName="feed-itunes-type"
                buttons={[{
                  'name': 'episodic',
                  'checked': channel['itunes:type'] === 'episodic',
                }, {
                  'name': 'serial',
                  'checked': channel['itunes:type'] === 'serial',
                }]}
                value={channel['itunes:type']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:type', e.target.value)}
              />
              <AdminInput
                label="<itunes:email>"
                type="email"
                value={channel['itunes:email']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:email', e.target.value)}
              />
              <AdminInput
                label="<copyright>"
                value={channel.copyright}
                onChange={(e) => this.onUpdateChannelMeta('copyright', e.target.value)}
              />
              <AdminInput
                label="<itunes:title>"
                value={channel['itunes:title']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:title', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <AdminRadio
                label="itunes:explicit"
                groupName="lh-explicit"
                buttons={[{
                  'name': 'Yes',
                  'checked': channel['itunes:explicit'],
                }, {
                  'name': 'No',
                  'checked': !channel['itunes:explicit'],
                }]}
                value={channel['itunes:explicit']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:explicit', e.target.value === 'Yes')}
              />
              <AdminRadio
                label="<itunes:block>"
                groupName="feed-itunes-block"
                buttons={[{
                  'name': 'Yes',
                  'checked': channel['itunes:block'],
                }, {
                  'name': 'No',
                  'checked': !channel['itunes:block'],
                }]}
                value={channel['itunes:block']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:block', e.target.value === 'Yes')}
              />
              <AdminRadio
                label="<itunes:complete>"
                groupName="feed-itunes-complete"
                buttons={[{
                  'name': 'Yes',
                  'checked': channel['itunes:complete'],
                }, {
                  'name': 'No',
                  'checked': !channel['itunes:complete'],
                }]}
                value={channel['itunes:complete']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:complete', e.target.value === 'Yes')}
              />
              <AdminInput
                label="<itunes:new-feed-url>"
                type="url"
                value={channel['itunes:new-feed-url']}
                onChange={(e) => this.onUpdateChannelMeta('itunes:new-feed-url', e.target.value)}
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
