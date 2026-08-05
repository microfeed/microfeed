import React from "react";

import {queueReplacedImageUrl} from "@/client/ImageUploadUtils";
import AdminImageUploaderApp from "@/components/admin/shared/AdminImageUploaderApp";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import {hasUploadedFavicon} from "@/shared/Favicon";
import SettingsBase from "../SettingsBase";

export const FAVICON_SUBMIT_KEY = "favicon";

export default class FaviconSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      favicon: props.feed.settings?.[
        SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS
      ]?.favicon ?? {},
    };
  }

  async saveUploadedFavicon(
    cdnUrl: string,
    contentType: string,
    replacedImageUrl: unknown,
  ) {
    const previousFavicon = this.state.favicon;
    const favicon = {contentType, url: cdnUrl};
    this.setState({favicon});
    const saved = await this.props.onSubmit(
      {preventDefault() {}},
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
      {favicon},
      queueReplacedImageUrl([], replacedImageUrl),
      FAVICON_SUBMIT_KEY,
    );
    if (!saved) {
      this.setState({favicon: previousFavicon});
    }
  }

  render() {
    const {favicon} = this.state;
    const {submitForType} = this.props;
    const usingChannelImage = !hasUploadedFavicon(favicon);
    const saving = submitForType === FAVICON_SUBMIT_KEY;

    return (
      <SettingsBase currentType={FAVICON_SUBMIT_KEY} title="Favicon">
        <p className="text-xs text-helper-color">
          {usingChannelImage
            ? "Your channel image is used until you upload a separate favicon."
            : "This uploaded favicon is used instead of your channel image."}
        </p>
        {saving && (
          <p aria-live="polite" className="mt-3 text-xs text-muted-foreground">
            Saving favicon...
          </p>
        )}
        <div className="mt-4 flex">
          <AdminImageUploaderApp
            currentImageUrl={usingChannelImage ? undefined : favicon.url}
            feed={this.props.feed}
            imageMetadataTarget={{type: "favicon"}}
            imageSizeNotOkayFunc={(width: any, height: any) =>
              (width > 256 && height > 256) || (width < 48 && height < 48)}
            imageSizeNotOkayMsgFunc={(width: any, height: any) => {
              if (width > 256 && height > 256) {
                return `Image too big: ${Number.parseInt(width)} x ${Number.parseInt(height)} pixels. ` +
                  "You'd better upload a smaller image for favicon.";
              }
              if (width < 48 && height < 48) {
                return `Image too small: ${Number.parseInt(width)} x ${Number.parseInt(height)} pixels. ` +
                  "You'd better upload a bigger image for favicon.";
              }
              return "";
            }}
            mediaStorage={this.props.mediaStorage}
            mediaStorageReady={this.props.mediaStorageReady}
            mediaType="favicon"
            publicBucketUrl={this.props.feed.settings?.[
              SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS
            ]?.publicBucketUrl}
            onImageDeleted={() => {
              this.setState({favicon: {}});
              this.props.onSettingsChanged(
                SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
                {favicon: undefined},
              );
            }}
            onImageUploaded={(
              cdnUrl: string,
              contentType: string,
              replacedImageUrl: unknown,
            ) => void this.saveUploadedFavicon(
              cdnUrl,
              contentType,
              replacedImageUrl,
            )}
          />
        </div>
      </SettingsBase>
    );
  }
}
