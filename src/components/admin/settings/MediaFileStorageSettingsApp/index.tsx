import React from "react";

import {showToast} from "@/client/ToastUtils";
import AdminInput from "@/components/admin/shared/AdminInput";
import {Button} from "@/components/ui/button";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import {
  isLocalDevelopmentHostname,
  isValidPublicBucketUrl,
  normalizePublicBucketUrl,
  resolvePublicBucketUrl,
} from "@/shared/StringUtils";
import SettingsBase from "../SettingsBase";

export const MEDIA_FILE_STORAGE_SUBMIT_KEY = "media-file-storage";

export default class MediaFileStorageSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    const savedSettings = props.feed.settings?.[
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS
    ] ?? {};
    const isLocalDevelopment = isLocalDevelopmentHostname(
      window.location.hostname,
    );
    const publicBucketUrl = resolvePublicBucketUrl(
      savedSettings.publicBucketUrl || "/media/",
      window.location.hostname,
    );
    this.state = {
      isLocalDevelopment,
      publicBucketUrl,
      savedPublicBucketUrl: publicBucketUrl,
    };
  }

  render() {
    const {
      isLocalDevelopment,
      publicBucketUrl,
      savedPublicBucketUrl,
    } = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    const changed = publicBucketUrl !== savedPublicBucketUrl;
    const submittingForThis = submitForType === MEDIA_FILE_STORAGE_SUBMIT_KEY;

    return (
      <SettingsBase
        currentType={MEDIA_FILE_STORAGE_SUBMIT_KEY}
        submitForType={submitForType}
        submitting={submitting}
        title="Media file storage"
      >
        <AdminInput
          customClass="text-xs"
          customLabelClass="m-input-label-small"
          disabled={isLocalDevelopment}
          extraParams={{
            inputMode: "url",
            spellCheck: false,
          }}
          label="R2 public bucket URL"
          type="text"
          value={publicBucketUrl}
          onChange={(event: any) => this.setState(
            {publicBucketUrl: event.target.value},
            () => setChanged(),
          )}
        />
        <p className="mt-2 text-xs text-helper-color">
          {isLocalDevelopment
            ? "Local development always serves uploaded files through /media/, backed by the local R2 binding."
            : <>
              Keep <code>/media/</code> to serve uploaded files through this
              Worker. Optionally,{
              " "
              }<a
                className="underline"
                href="https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains"
                rel="noopener noreferrer"
                target="_blank"
              >
                connect a custom domain to your R2 bucket
              </a>{" "}and enter its complete URL here, such as{
              " "
              }<code>https://media.example.com/</code>.
            </>}
        </p>
        {changed && (
          <div className="mt-5 flex justify-end">
            <Button
              disabled={submittingForThis || submitting}
              type="button"
              onClick={async (event) => {
                const normalizedPublicBucketUrl = normalizePublicBucketUrl(
                  publicBucketUrl,
                );
                if (
                  normalizedPublicBucketUrl &&
                  !isValidPublicBucketUrl(normalizedPublicBucketUrl)
                ) {
                  showToast(
                    "Invalid URL. Use /media/ or a complete URL starting with http:// or https://, " +
                      "for example, https://media.example.com/",
                    "error",
                    5000,
                  );
                  return;
                }
                const saved = await this.props.onSubmit(
                  event,
                  SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
                  {publicBucketUrl: normalizedPublicBucketUrl},
                  [],
                  MEDIA_FILE_STORAGE_SUBMIT_KEY,
                );
                if (saved) {
                  this.setState({
                    publicBucketUrl: normalizedPublicBucketUrl,
                    savedPublicBucketUrl: normalizedPublicBucketUrl,
                  });
                }
              }}
            >
              {submittingForThis ? "Updating..." : "Update"}
            </Button>
          </div>
        )}
      </SettingsBase>
    );
  }
}
