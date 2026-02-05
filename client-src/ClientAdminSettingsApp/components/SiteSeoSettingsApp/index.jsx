import React from 'react';
import AdminInput from "../../../components/AdminInput";
import AdminTextarea from "../../../components/AdminTextarea";
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import SettingsBase from "../SettingsBase";
import {showToast} from "../../../common/ToastUtils";

const SUBMIT_STATUS__START = 1;

export default class SiteSeoSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.onSubmit = this.onSubmit.bind(this);
    this.state = {
      submitStatus: null,
      loading: true,
      data: {
        site_name: '',
        default_title: '',
        default_description: '',
        default_og_image: '',
        twitter_handle: '',
        logo_url: '',
        language: '',
      },
    };
  }

  componentDidMount() {
    fetch('/admin/ajax/site-seo').then((res) => res.json()).then((json) => {
      this.setState({
        loading: false,
        data: {
          ...this.state.data,
          ...(json.item || {}),
        },
      });
    }).catch(() => {
      this.setState({loading: false});
    });
  }

  onSubmit(e) {
    e.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});
    fetch('/admin/ajax/site-seo', {
      method: 'PUT',
      headers: {'content-type': 'application/json;charset=UTF-8'},
      body: JSON.stringify(this.state.data),
    }).then((res) => {
      if (res.ok) {
        showToast('Updated!', 'success');
      } else {
        showToast('Failed. Please try again.', 'error');
      }
      this.setState({submitStatus: null});
    }).catch(() => {
      showToast('Network error. Please refresh the page and try again.', 'error');
      this.setState({submitStatus: null});
    });
  }

  render() {
    const {feed} = this.props;
    const {data, submitStatus} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (
      <SettingsBase
        title="Site SEO"
        currentType="site-seo"
        submitting={submitting}
        submitForType={submitting ? "site-seo" : null}
        onSubmit={this.onSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <AdminInput
            label="Site name"
            value={data.site_name}
            onChange={(e) => this.setState({data: {...data, site_name: e.target.value}})}
          />
          <AdminInput
            label="Default title"
            value={data.default_title}
            onChange={(e) => this.setState({data: {...data, default_title: e.target.value}})}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <AdminTextarea
            label="Default description"
            value={data.default_description}
            onChange={(e) => this.setState({data: {...data, default_description: e.target.value}})}
            minRows={3}
            maxRows={6}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <AdminInput
            label="Twitter handle"
            value={data.twitter_handle}
            onChange={(e) => this.setState({data: {...data, twitter_handle: e.target.value}})}
            placeholder="@yourhandle"
          />
          <AdminInput
            label="Language"
            value={data.language}
            onChange={(e) => this.setState({data: {...data, language: e.target.value}})}
            placeholder="en"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <div className="lh-page-subtitle">Default OG image</div>
            <AdminImageUploaderApp
              mediaType="site-seo-og"
              feed={feed}
              currentImageUrl={data.default_og_image}
              onImageUploaded={(cdnUrl) => this.setState({data: {...data, default_og_image: cdnUrl}})}
            />
          </div>
          <div>
            <div className="lh-page-subtitle">Logo</div>
            <AdminImageUploaderApp
              mediaType="site-seo-logo"
              feed={feed}
              currentImageUrl={data.logo_url}
              onImageUploaded={(cdnUrl) => this.setState({data: {...data, logo_url: cdnUrl}})}
            />
          </div>
        </div>
      </SettingsBase>
    );
  }
}
