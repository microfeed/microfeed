import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import AdminInput from "../../../components/AdminInput";
import AdminRadio from "../../../components/AdminRadio";
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";
import {isValidUrl} from "../../../../common-src/StringUtils";
import {showToast} from "../../../common/ToastUtils";

const PUBLISHER_TYPES = {
  ORGANIZATION: 'Organization',
  PERSON: 'Person',
};

export default class SeoSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.addSameAs = this.addSameAs.bind(this);
    this.removeSameAs = this.removeSameAs.bind(this);
    this.updateSameAs = this.updateSameAs.bind(this);

    const currentType = SETTINGS_CATEGORIES.SEO;
    const {feed} = props;

    let siteName = '';
    let defaultShareImage = {};
    let keyTerms = '';
    let publisherType = PUBLISHER_TYPES.ORGANIZATION;
    let publisherName = '';
    let publisherLogo = {};
    let sameAs = [];
    let twitterHandle = '';

    if (feed.settings && feed.settings[currentType]) {
      const seoSettings = feed.settings[currentType];
      siteName = seoSettings.siteName || '';
      defaultShareImage = seoSettings.defaultShareImage || {};
      keyTerms = seoSettings.keyTerms || '';
      publisherType = seoSettings.publisherType || PUBLISHER_TYPES.ORGANIZATION;
      publisherName = seoSettings.publisherName || '';
      publisherLogo = seoSettings.publisherLogo || {};
      sameAs = Array.isArray(seoSettings.sameAs) ? [...seoSettings.sameAs] : [];
      twitterHandle = seoSettings.twitterHandle || '';
    }

    this.state = {
      feed,

      currentType,
      siteName,
      defaultShareImage,
      keyTerms,
      publisherType,
      publisherName,
      publisherLogo,
      sameAs,
      twitterHandle,
    };
  }

  addSameAs() {
    const {sameAs} = this.state;
    this.setState({sameAs: [...sameAs, '']}, () => this.props.setChanged());
  }

  removeSameAs(index) {
    const {sameAs} = this.state;
    const newSameAs = [...sameAs];
    newSameAs.splice(index, 1);
    this.setState({sameAs: newSameAs}, () => this.props.setChanged());
  }

  updateSameAs(index, value) {
    const {sameAs} = this.state;
    const newSameAs = [...sameAs];
    newSameAs[index] = value;
    this.setState({sameAs: newSameAs}, () => this.props.setChanged());
  }

  render() {
    const {
      feed, currentType, siteName, defaultShareImage, keyTerms, publisherType,
      publisherName, publisherLogo, sameAs, twitterHandle,
    } = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    return (<SettingsBase
      title="SEO"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        const invalidUrl = sameAs.find((url) => url && !isValidUrl(url));
        if (invalidUrl) {
          showToast(
            `Invalid url: ${invalidUrl}. A valid url should start with http:// or https://`,
            'error', 5000,
          );
          return;
        }
        this.props.onSubmit(e, currentType, {
          siteName,
          defaultShareImage,
          keyTerms,
          publisherType,
          publisherName,
          publisherLogo,
          sameAs: sameAs.filter((url) => url && url.trim().length > 0),
          twitterHandle,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">Site identity</summary>
          <div className="grid grid-cols-1 gap-4">
            <AdminInput
              label="Site name"
              customLabelClass="m-input-label-small"
              customClass="text-xs"
              value={siteName}
              placeholder="Defaults to the channel title"
              onChange={(e) => this.setState({siteName: e.target.value}, () => setChanged())}
            />
            <AdminInput
              label="Key terms"
              customLabelClass="m-input-label-small"
              customClass="text-xs"
              value={keyTerms}
              placeholder="Comma-separated, e.g. podcasts, tech, interviews"
              onChange={(e) => this.setState({keyTerms: e.target.value}, () => setChanged())}
            />
            <AdminInput
              label="Twitter handle"
              customLabelClass="m-input-label-small"
              customClass="text-xs"
              value={twitterHandle}
              placeholder="@handle"
              onChange={(e) => this.setState({twitterHandle: e.target.value}, () => setChanged())}
            />
          </div>
        </details>
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">Default share image</summary>
          <div className="flex">
            <AdminImageUploaderApp
              feed={feed}
              mediaType="seo-share-image"
              currentImageUrl={defaultShareImage.url}
              onImageUploaded={(cdnUrl, contentType) => this.setState({
                defaultShareImage: {
                  url: cdnUrl,
                  contentType,
                },
              }, () => setChanged())}
            />
          </div>
        </details>
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">Publisher</summary>
          <div className="grid grid-cols-1 gap-4">
            <AdminRadio
              label="Publisher type"
              customLabelClass="m-input-label-small"
              groupName="publisher-type"
              buttons={[{
                name: PUBLISHER_TYPES.ORGANIZATION,
                value: PUBLISHER_TYPES.ORGANIZATION,
                checked: publisherType === PUBLISHER_TYPES.ORGANIZATION,
              }, {
                name: PUBLISHER_TYPES.PERSON,
                value: PUBLISHER_TYPES.PERSON,
                checked: publisherType === PUBLISHER_TYPES.PERSON,
              }]}
              onChange={(e) => this.setState({publisherType: e.target.value}, () => setChanged())}
            />
            <AdminInput
              label="Publisher name"
              customLabelClass="m-input-label-small"
              customClass="text-xs"
              value={publisherName}
              placeholder="Defaults to the channel title"
              onChange={(e) => this.setState({publisherName: e.target.value}, () => setChanged())}
            />
            <div className="flex">
              <AdminImageUploaderApp
                feed={feed}
                mediaType="seo-publisher-logo"
                currentImageUrl={publisherLogo.url}
                onImageUploaded={(cdnUrl, contentType) => this.setState({
                  publisherLogo: {
                    url: cdnUrl,
                    contentType,
                  },
                }, () => setChanged())}
              />
            </div>
          </div>
        </details>
        <details open>
          <summary className="lh-page-subtitle cursor-pointer">Social links (sameAs)</summary>
          <div className="grid grid-cols-1 gap-2">
            {sameAs.map((url, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <AdminInput
                    type="url"
                    customClass="text-xs"
                    value={url}
                    placeholder="https://twitter.com/yourhandle"
                    onChange={(e) => this.updateSameAs(index, e.target.value)}
                  />
                </div>
                <div className="flex-none">
                  <button
                    type="button"
                    className="lh-btn"
                    onClick={() => this.removeSameAs(index)}
                  >Remove</button>
                </div>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="lh-btn"
                onClick={this.addSameAs}
              >Add link</button>
            </div>
          </div>
        </details>
      </div>
    </SettingsBase>);
  }
}
