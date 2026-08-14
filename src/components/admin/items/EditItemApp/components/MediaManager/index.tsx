import React from 'react';
import Requests from '@/client/requests';
import {
  ADMIN_URLS,
  humanFileSize,
  randomHex,
  resolvePublicBucketUrl,
  secondsToHHMMSS,
  urlJoinWithRelative
} from '@/shared/StringUtils';
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  SUPPORTED_ENCLOSURE_CATEGORIES
} from "@/shared/Constants";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import AdminInput from "@/components/admin/shared/AdminInput";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import FileUploader from "@/components/admin/shared/AdminFileUploader";
import {CloudUploadIcon, ImagesIcon} from "lucide-react";
import {getPublicBaseUrl} from "@/client/ClientUrlUtils";
import {showToast} from "@/client/ToastUtils";
import {getMediaFileFromUrl} from "@/shared/MediaFileUtils";
import type {MediaLibraryRecord} from "@/shared/MediaLibrary";
import MediaStorageUnavailableDialog from "@/components/admin/shared/MediaStorageUnavailableDialog";
import {Button} from "@/components/ui/button";

const UPLOAD_STATUS__START = 1;

function PreviewCurrentMediaFile({url, contentType, category, durationSecond, sizeByte, setRef, updateDuration}: any) {
  return (<div className="mb-8">
      <div className="mb-2 text-sm font-semibold text-foreground">Current {category}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {category === ENCLOSURE_CATEGORIES.AUDIO && <div>
          <audio controls preload="metadata" ref={setRef} onLoadedMetadata={updateDuration}>
            <source src={url} type={contentType}/>
            Your browser does not support the audio element.
          </audio>
        </div>}
        {category === ENCLOSURE_CATEGORIES.VIDEO && <div>
          <video width="80%" preload="metadata" controls ref={setRef} onLoadedMetadata={updateDuration}>
            <source src={url} type={contentType} />
            Your browser does not support the video tag.
          </video>
        </div>}
        {category === ENCLOSURE_CATEGORIES.IMAGE && <div>
          <img src={url} alt={contentType} width="80%" />
        </div>}
        <div className="text-sm">
          <div className="mb-1">
            <span className="text-helper-color">Content type:</span> {contentType}
          </div>
          <div className="mb-1">
            <span className="text-helper-color">File size:</span> {humanFileSize(sizeByte)}
          </div>
          {[ENCLOSURE_CATEGORIES.AUDIO, ENCLOSURE_CATEGORIES.VIDEO].includes(category) && <div className="mb-1">
            <span className="text-helper-color">Duration:</span> {secondsToHHMMSS(durationSecond)}
          </div>}
          <div className="break-all">
            <span className="text-helper-color">Download url:</span> <a href={url} className="text-xs" target="_blank">{url}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaUploader(
  {url, category, contentType, sizeByte, durationSecond, setRef, uploading, progressText,
    onFileUpload, onMediaStorageUnavailable, updateDuration, publicBucketUrl,
    mediaStorageReady}: any) {
  const {fileTypes} = (ENCLOSURE_CATEGORIES_DICT[category] as any);
  const fileNotExist = !!url;
  const headerTitle = fileNotExist ? `Upload a new ${category} file to replace this one` :
    `Upload a new ${category} file`;
  return (<div>
    {url && <PreviewCurrentMediaFile
      url={urlJoinWithRelative(publicBucketUrl, url)}
      category={category}
      contentType={contentType}
      sizeByte={sizeByte}
      durationSecond={durationSecond}
      setRef={setRef}
      updateDuration={updateDuration}
    />}
    {url && <div className="border-t pt-2 mb-2"/>}
    {!mediaStorageReady && <div className="mb-3 rounded-sm border p-3 text-sm text-helper-color">
      File uploads are unavailable until R2 media storage is enabled. You can
      still choose <strong>external URL</strong> above.
    </div>}
    <details className="lh-upload-wrapper w-full" open={!fileNotExist}>
      <summary className="m-page-summary mt-4 text-sm">
        {headerTitle}
      </summary>
      <FileUploader
        handleChange={onFileUpload}
        name="audioUploader"
        types={fileTypes}
        disabled={uploading || !mediaStorageReady}
        onDisabledClick={!uploading
          ? onMediaStorageUnavailable
          : undefined}
        classes="lh-upload-fileinput"
      >
        <div className="w-full h-24 lh-upload-box mt-2 p-4 flex items-center justify-center">
          {uploading ? <div className="text-helper-color">
            <div className="font-semibold">Uploading...</div>
            <div className="text-sm">{progressText}</div>
          </div> : <div className="text-brand-light">
            <div className="flex items-center">
              <div className="mr-1"><CloudUploadIcon className="w-8"/></div>
              <div className="font-semibold">Click or drag here to upload {category}</div>
            </div>
            <div className="text-sm">{fileTypes.join(', ')}</div>
          </div>}
        </div>
      </FileUploader>
    </details>
  </div>);
}

function UrlEditor({url, onUpdateUrl}: any) {
  const bookmarkletCode = `javascript:window.location=%22${ADMIN_URLS.newItem(getPublicBaseUrl())}?media_category=external_url&` +
    'media_url=%22+encodeURIComponent(document.location)+%22&title=%22+encodeURIComponent(document.title)';
  const bookmarklet = `<a href="${bookmarkletCode}" onclick="return false" rel="nofollow">to microfeed</a>`;
  return (<div>
    <AdminInput
      placeholder="e.g., https://www.nytimes.com/2022/11/13/us/politics/senate-democrats-republicans.html"
      customClass="text-xs"
      type="url"
      value={url}
      onChange={(e: any) => onUpdateUrl(e.target.value)}
    />
    <details className="mt-4 text-helper-color">
      <summary className="hover:opacity-50 text-sm cursor-pointer">
        Bookmarklet: add a "to microfeed" button to browser
      </summary>
      <div className="mt-4 text-sm">
        Drag this link to your browser, so you can easily curate web pages here -
        <div className="mt-4 underline" dangerouslySetInnerHTML={{__html: bookmarklet}} />
      </div>
    </details>
  </div>);
}

export default class MediaManager extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.onFileUpload = this.onFileUpload.bind(this);
    this.showMediaStorageUnavailable =
      this.showMediaStorageUnavailable.bind(this);
    this.setState = this.setState.bind(this);

    const {initMediaFile} = props;
    const urlParams = new URLSearchParams(window.location.search);
    const mediaFileFromUrl = getMediaFileFromUrl(urlParams);

    const mediaFile = {
      ...initMediaFile,
      ...mediaFileFromUrl,
    };
    let {url, category, contentType, sizeByte, durationSecond} = mediaFile || {};
    const mediaStorageReady = props.mediaStorageReady !== false;

    const webGlobalSettings = props.feed.settings.webGlobalSettings || {};
    const publicBucketUrl = resolvePublicBucketUrl(
      webGlobalSettings.publicBucketUrl,
      window.location.hostname,
    );

    this.initState = {
      url: '',
      contentType: null,
      sizeByte: 0,
      durationSecond: 0,
      uploadStatus: null,
      progressText: '0.00%',
    };

    this.state = {
      publicBucketUrl,

      url,
      category: category || (
        mediaStorageReady
          ? ENCLOSURE_CATEGORIES.AUDIO
          : ENCLOSURE_CATEGORIES.EXTERNAL_URL
      ),
      contentType,
      sizeByte,
      durationSecond: durationSecond || 0,

      uploadStatus: null,
      progressText: '0.00%',
      showMediaStorageUnavailable: false,
      showLibrary: false,
      libraryEntries: [],
      libraryLoading: false,
    };
  }

  onFileUpload(file: any) {
    if (this.props.mediaStorageReady === false) {
      this.showMediaStorageUnavailable();
      return;
    }
    const {category} = this.state;
    this.setState({uploadStatus: UPLOAD_STATUS__START});
    const {name, size, type} = file;
    const extension = name.slice((name.lastIndexOf('.') - 1 >>> 0) + 2);
    let newFilename = `${category}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    const cdnFilename = `media/${newFilename}`;

    const updateState = (cdnUrl: any) => {
      this.setState({
        progressText: null,
        uploadStatus: null,

        url: cdnUrl,
        contentType: type,
        sizeByte: size,
      }, () => {
        this.props.onMediaFileUpdated({
          url: cdnUrl,
          sizeByte: size,
          contentType: type,
          category,
        }, {immediate: true});
        if (this.audioRef && category === ENCLOSURE_CATEGORIES.AUDIO) {
          this.audioRef.pause();
          this.audioRef.load();
        } else if (this.videoRef && category === ENCLOSURE_CATEGORIES.VIDEO) {
          this.videoRef.pause();
          this.videoRef.load();
        }
      });
    };

    Requests.upload(file, cdnFilename, (percentage: any) => {
      this.setState({progressText: `${Number(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl: any) => {
        updateState(cdnUrl);
    }, () => {
      showToast('Failed to upload. Please refresh this page and try again.', 'error', 2000);
      this.setState({...this.initState});
    }, (error: any) => {
      this.setState({...this.initState}, () => {
        if (!error.response) {
          showToast('Network error. Please refresh the page and try again.', 'error');
        } else {
          showToast('Failed. Please try again.', 'error');
        }
      });
    });
  }

  showMediaStorageUnavailable() {
    this.setState({showMediaStorageUnavailable: true});
  }

  async openLibrary() {
    this.setState({showLibrary: true, libraryLoading: true});
    try {
      const response = await fetch(ADMIN_URLS.ajaxMediaLibrary(), {
        headers: {accept: "application/json"},
      });
      const body = await response.json().catch(() => ({})) as {
        items?: MediaLibraryRecord[];
      };
      this.setState({
        libraryEntries: Array.isArray(body.items) ? body.items : [],
        libraryLoading: false,
      });
    } catch {
      this.setState({libraryLoading: false});
      showToast("Failed to load the media library.", "error");
    }
  }

  pickFromLibrary(entry: MediaLibraryRecord) {
    this.setState({
      showLibrary: false,
      url: entry.object_key,
      contentType: entry.content_type || 'image/avif',
      sizeByte: entry.size_bytes || 0,
    }, () => {
      this.props.onMediaFileUpdated({
        url: entry.object_key,
        sizeByte: entry.size_bytes || 0,
        contentType: entry.content_type || 'image/avif',
        category: ENCLOSURE_CATEGORIES.IMAGE,
      }, {immediate: true});
    });
  }

  render() {
    const {
      category, url, contentType, sizeByte, durationSecond,
      uploadStatus, progressText, publicBucketUrl,
      showMediaStorageUnavailable, showLibrary, libraryEntries,
      libraryLoading,
    } = this.state;
    const {label, labelComponent} = this.props;
    const mediaStorageReady = this.props.mediaStorageReady !== false;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      {label && <h2 className="mb-4 text-lg font-semibold tracking-tight">
        {label}
      </h2>}
      {labelComponent}
      <div className="flex">
        <AdminRadioGroup
          ariaLabel="Media category"
          name="category"
          className="font-semibold"
          value={category}
          options={SUPPORTED_ENCLOSURE_CATEGORIES.map((cat: any) => ({
            label: (ENCLOSURE_CATEGORIES_DICT[cat] as any).name,
            value: cat,
            disabled: !mediaStorageReady &&
              cat !== ENCLOSURE_CATEGORIES.EXTERNAL_URL,
            onDisabledClick: !mediaStorageReady &&
                cat !== ENCLOSURE_CATEGORIES.EXTERNAL_URL
              ? this.showMediaStorageUnavailable
              : undefined,
          }))}
          disabled={uploading}
          onValueChange={(nextCategory) => {
            if (url) {
              const {name} = (ENCLOSURE_CATEGORIES_DICT[category] as any);
              const newName = (ENCLOSURE_CATEGORIES_DICT[nextCategory] as any).name;
              const ok = confirm(`To switch to ${newName}, you should discard ${name} first. This will delete existing ${name}. Do you want to proceed?`);
              if (!ok) {
                return;
              }
            }
            this.setState({category: nextCategory, ...this.initState}, () => {
              this.props.onMediaFileUpdated({
                category: nextCategory,
                contentType: null,
                durationSecond: 0,
                sizeByte: 0,
                url: '',
              });
            });
          }}
        />
      </div>
      <div className="mt-4">
        {[ENCLOSURE_CATEGORIES.EXTERNAL_URL].includes(category) ? <UrlEditor
          url={url}
          onUpdateUrl={(newUrl: any) => {
            this.setState((prevState: any) => ({
              ...prevState,
              url: newUrl,
              contentType: 'text/html',  // TODO: dynamically fetch content type by sending HEAD request
            }), () => {
              this.props.onMediaFileUpdated({
                url: this.state.url,
                durationSecond: this.state.durationSecond,
                sizeByte: this.state.sizeByte,
                contentType: this.state.contentType,
                category: this.state.category,
              });
            })
          }}
        /> : <MediaUploader
          publicBucketUrl={publicBucketUrl}
          mediaStorageReady={mediaStorageReady}
          url={url}
          category={category}
          contentType={contentType}
          sizeByte={sizeByte}
          durationSecond={durationSecond}
          updateDuration={(e: any) => {
            try {
              const newDurationSecond = parseInt(e.target.duration, 10);
              if (newDurationSecond > 0) {
                this.setState({
                  durationSecond: newDurationSecond,
                }, () => {
                  this.props.onMediaFileUpdated({
                    durationSecond: newDurationSecond,
                  }, {immediate: true});
                });
              }
            } catch (e) { // eslint-disable-line
            }
          }}
          setRef={(ref: any) => {
            if (category === ENCLOSURE_CATEGORIES.AUDIO) {
              this.audioRef = ref;
            } else if (category ===  ENCLOSURE_CATEGORIES.VIDEO) {
              this.videoRef = ref;
            }
          }}
          uploading={uploading}
          progressText={progressText}
          onFileUpload={this.onFileUpload}
          onMediaStorageUnavailable={this.showMediaStorageUnavailable}
        />}
        {category === ENCLOSURE_CATEGORIES.IMAGE && (
          <div className="mt-3">
            <Button
              disabled={uploading}
              onClick={() => void this.openLibrary()}
              size="sm"
              type="button"
              variant="outline"
            >
              <ImagesIcon aria-hidden="true" /> Choose from library
            </Button>
          </div>
        )}
      </div>
      <MediaStorageUnavailableDialog
        dashboardUrl={this.props.mediaStorage?.dashboardUrl}
        onOpenChange={(open) => this.setState({
          showMediaStorageUnavailable: open,
        })}
        open={showMediaStorageUnavailable}
        state={this.props.mediaStorage?.mediaStorageState}
      />
      <AdminDialog
        title="Choose from media library"
        open={showLibrary}
        onOpenChange={(open) => this.setState({showLibrary: open})}
      >
        <div className="p-4">
          {libraryLoading ? (
            <p className="text-sm text-muted-foreground">Loading media library...</p>
          ) : libraryEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No media yet. Upload an image first and it will appear here.
            </p>
          ) : (
            <div className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto">
              {libraryEntries.map((entry: MediaLibraryRecord) => (
                <button
                  className="group relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted outline-none transition hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                  key={entry.id}
                  onClick={() => this.pickFromLibrary(entry)}
                  title={entry.filename}
                  type="button"
                >
                  {entry.content_type?.startsWith("image/") ? (
                    <img
                      alt={entry.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={urlJoinWithRelative(publicBucketUrl, entry.url)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImagesIcon aria-hidden="true" className="size-6" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </AdminDialog>
    </div>);
  }
}
