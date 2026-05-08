import React from 'react';
import Requests from '../../../../../common/requests';
import {
  ADMIN_URLS,
  humanFileSize,
  randomHex,
  secondsToHHMMSS,
  urlJoinWithRelative
} from '../../../../../../common-src/StringUtils';
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  SUPPORTED_ENCLOSURE_CATEGORIES
} from "../../../../../../common-src/Constants";
import AdminRadio from "../../../../../components/AdminRadio";
import AdminInput from "../../../../../components/AdminInput";
import {FileUploader} from "react-drag-drop-files";
import {CloudArrowUpIcon} from "@heroicons/react/24/outline";
import {getPublicBaseUrl} from "../../../../../common/ClientUrlUtils";
import {showToast} from "../../../../../common/ToastUtils";
import {getMediaFileFromUrl} from "../../../../../../common-src/MediaFileUtils";
import {pickDocumentText} from "../../../../../common/LanguageUtils";

const UPLOAD_STATUS__START = 1;

function PreviewCurrentMediaFile({url, contentType, category, durationSecond, sizeByte, setRef, updateDuration}) {
  return (<div className="mb-8">
      <div className="lh-page-subtitle">{pickDocumentText(`当前${ENCLOSURE_CATEGORIES_DICT[category].labelZh}`, `Current ${category}`)}</div>
      <div className="grid grid-cols-2 gap-4">
        {category === ENCLOSURE_CATEGORIES.AUDIO && <div className="col-span-1">
          <audio controls preload="metadata" ref={setRef} onLoadedMetadata={updateDuration}>
            <source src={url} type={contentType}/>
            {pickDocumentText('你的浏览器暂不支持音频播放。', 'Your browser does not support the audio element.')}
          </audio>
        </div>}
        {category === ENCLOSURE_CATEGORIES.VIDEO && <div className="col-span-1">
          <video width="80%" preload="metadata" controls ref={setRef} onLoadedMetadata={updateDuration}>
            <source src={url} type={contentType} />
            {pickDocumentText('你的浏览器暂不支持视频播放。', 'Your browser does not support the video tag.')}
          </video>
        </div>}
        {category === ENCLOSURE_CATEGORIES.IMAGE && <div className="col-span-1">
          <img src={url} alt={contentType} width="80%" />
        </div>}
        <div className="col-span-1 text-sm">
          <div className="mb-1">
            <span className="text-helper-color">{pickDocumentText('内容类型：', 'Content type:')}</span> {contentType}
          </div>
          <div className="mb-1">
            <span className="text-helper-color">{pickDocumentText('文件大小：', 'File size:')}</span> {humanFileSize(sizeByte)}
          </div>
          {[ENCLOSURE_CATEGORIES.AUDIO, ENCLOSURE_CATEGORIES.VIDEO].includes(category) && <div className="mb-1">
            <span className="text-helper-color">{pickDocumentText('时长：', 'Duration:')}</span> {secondsToHHMMSS(durationSecond)}
          </div>}
          <div className="break-all">
            <span className="text-helper-color">{pickDocumentText('下载地址：', 'Download url:')}</span> <a href={url} className="text-xs" target="_blank">{url}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaUploader(
  {url, category, contentType, sizeByte, durationSecond, setRef, uploading, progressText,
    onFileUpload, updateDuration, publicBucketUrl}) {
  const {fileTypes} = ENCLOSURE_CATEGORIES_DICT[category];
  const fileNotExist = !!url;
  const categoryLabel = pickDocumentText(ENCLOSURE_CATEGORIES_DICT[category].labelZh, category);
  const headerTitle = fileNotExist ? pickDocumentText(`上传新的${categoryLabel}文件以替换当前文件`, `Upload a new ${category} file to replace this one`) :
    pickDocumentText(`上传新的${categoryLabel}文件`, `Upload a new ${category} file`);
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
    <details className="lh-upload-wrapper" open={!fileNotExist}>
      <summary className="m-page-summary mt-4 text-sm">
        {headerTitle}
      </summary>
      <FileUploader
        handleChange={onFileUpload}
        name="audioUploader"
        types={fileTypes}
        disabled={uploading}
        classes="lh-upload-fileinput"
      >
        <div className="w-full h-24 lh-upload-box mt-2 p-4 flex items-center justify-center">
          {uploading ? <div className="text-helper-color">
            <div className="font-semibold">{pickDocumentText('上传中...', 'Uploading...')}</div>
            <div className="text-sm">{progressText}</div>
          </div> : <div className="text-brand-light">
            <div className="flex items-center">
              <div className="mr-1"><CloudArrowUpIcon className="w-8"/></div>
              <div className="font-semibold">{pickDocumentText(`点击或拖拽到这里上传${categoryLabel}`, `Click or drag here to upload ${category}`)}</div>
            </div>
            <div className="text-sm">{fileTypes.join(', ')}</div>
          </div>}
        </div>
      </FileUploader>
    </details>
  </div>);
}

function UrlEditor({url, onUpdateUrl}) {
  const bookmarkletCode = `javascript:window.location=%22${ADMIN_URLS.newItem(getPublicBaseUrl())}?media_category=external_url&` +
    'media_url=%22+encodeURIComponent(document.location)+%22&title=%22+encodeURIComponent(document.title)';
  const bookmarklet = `<a href="${bookmarkletCode}" onclick="return false" rel="nofollow">to microfeed</a>`;
  return (<div>
    <AdminInput
      placeholder={pickDocumentText('例如：https://www.nytimes.com/2022/11/13/us/politics/senate-democrats-republicans.html', 'e.g., https://www.nytimes.com/2022/11/13/us/politics/senate-democrats-republicans.html')}
      customClass="text-xs"
      type="url"
      value={url}
      onChange={(e) => onUpdateUrl(e.target.value)}
    />
    <details className="mt-4 text-helper-color">
      <summary className="hover:opacity-50 text-sm cursor-pointer">
        {pickDocumentText('书签脚本：把“to microfeed”按钮加入浏览器', 'Bookmarklet: add a "to microfeed" button to browser')}
      </summary>
      <div className="mt-4 text-sm">
        {pickDocumentText('把这个链接拖到浏览器书签栏，就能更方便地把网页收藏到这里：', 'Drag this link to your browser, so you can easily curate web pages here -')}
        <div className="mt-4 underline" dangerouslySetInnerHTML={{__html: bookmarklet}} />
      </div>
    </details>
  </div>);
}

export default class MediaManager extends React.Component {
  constructor(props) {
    super(props);

    this.onFileUpload = this.onFileUpload.bind(this);
    this.setState = this.setState.bind(this);

    const {initMediaFile} = props;
    const urlParams = new URLSearchParams(window.location.search);
    const mediaFileFromUrl = getMediaFileFromUrl(urlParams);

    const mediaFile = {
      ...initMediaFile,
      ...mediaFileFromUrl,
    };
    let {url, category, contentType, sizeByte, durationSecond} = mediaFile || {};

    const webGlobalSettings = props.feed.settings.webGlobalSettings || {};
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';

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
      category: category || ENCLOSURE_CATEGORIES.AUDIO,
      contentType,
      sizeByte,
      durationSecond: durationSecond || 0,

      uploadStatus: null,
      progressText: '0.00%',
    };
  }

  onFileUpload(file) {
    const {category} = this.state;
    this.setState({uploadStatus: UPLOAD_STATUS__START});
    const {name, size, type} = file;
    const extension = name.slice((name.lastIndexOf('.') - 1 >>> 0) + 2);
    let newFilename = `${category}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    const cdnFilename = `media/${newFilename}`;

    const updateState = (cdnUrl) => {
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
        });
        if (this.audioRef && category === ENCLOSURE_CATEGORIES.AUDIO) {
          this.audioRef.pause();
          this.audioRef.load();
        } else if (this.videoRef && category === ENCLOSURE_CATEGORIES.VIDEO) {
          this.videoRef.pause();
          this.videoRef.load();
        }
      });
    };

    Requests.upload(file, cdnFilename, (percentage) => {
      this.setState({progressText: `${parseFloat(percentage * 100.0).toFixed(2)}%`});
    }, (cdnUrl) => {
        updateState(cdnUrl, 0);
    }, () => {
      showToast(pickDocumentText('上传失败，请刷新页面后重试。', 'Failed to upload. Please refresh this page and try again.'), 'error', 2000);
      this.setState({...this.initState});
    }, (error) => {
      this.setState({...this.initState}, () => {
        if (!error.response) {
          showToast(pickDocumentText('网络错误，请刷新页面后重试。', 'Network error. Please refresh the page and try again.'), 'error');
        } else {
          showToast(pickDocumentText('上传失败，请重试。', 'Failed. Please try again.'), 'error');
        }
      });
    });
  }

  render() {
    const {
      category, url, contentType, sizeByte, durationSecond,
      uploadStatus, progressText, publicBucketUrl,
    } = this.state;
    const {label, labelComponent} = this.props;
    const uploading = uploadStatus === UPLOAD_STATUS__START;
    return (<div>
      {label && <h2 className="lh-page-title">
        {label}
      </h2>}
      {labelComponent}
      <div className="flex">
        <AdminRadio
          groupName="category"
          customClass="font-semibold"
          buttons={SUPPORTED_ENCLOSURE_CATEGORIES.map((cat) => ({
            name: pickDocumentText(ENCLOSURE_CATEGORIES_DICT[cat].labelZh, ENCLOSURE_CATEGORIES_DICT[cat].name),
            value: cat,
            checked: cat === category,
          }))}
          disabled={uploading}
          onChange={(e) => {
            if (url) {
              const currentLabel = pickDocumentText(ENCLOSURE_CATEGORIES_DICT[category].labelZh, ENCLOSURE_CATEGORIES_DICT[category].name);
              const nextLabel = pickDocumentText(ENCLOSURE_CATEGORIES_DICT[e.target.value].labelZh, ENCLOSURE_CATEGORIES_DICT[e.target.value].name);
              const ok = confirm(pickDocumentText(`切换到${nextLabel}之前，需要先丢弃当前${currentLabel}。这会删除现有${currentLabel}，确定继续吗？`, `To switch to ${nextLabel}, you should discard ${currentLabel} first. This will delete existing ${currentLabel}. Do you want to proceed?`));
              if (!ok) {
                return;
              }
            }
            this.setState({category: e.target.value, ...this.initState});
          }}
        />
      </div>
      <div className="mt-4">
        {[ENCLOSURE_CATEGORIES.EXTERNAL_URL].includes(category) ? <UrlEditor
          url={url}
          onUpdateUrl={(newUrl) => {
            this.setState(prevState => ({
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
          url={url}
          category={category}
          contentType={contentType}
          sizeByte={sizeByte}
          durationSecond={durationSecond}
          updateDuration={(e) => {
            try {
              const newDurationSecond = parseInt(e.target.duration, 10);
              if (newDurationSecond > 0) {
                this.setState({
                  durationSecond: newDurationSecond,
                }, () => {
                  this.props.onMediaFileUpdated({
                    durationSecond: newDurationSecond,
                  });
                });
              }
            } catch (e) { // eslint-disable-line
            }
          }}
          setRef={(ref) => {
            if (category === ENCLOSURE_CATEGORIES.AUDIO) {
              this.audioRef = ref;
            } else if (category ===  ENCLOSURE_CATEGORIES.VIDEO) {
              this.videoRef = ref;
            }
          }}
          uploading={uploading}
          progressText={progressText}
          onFileUpload={this.onFileUpload}
        />}
      </div>
    </div>);
  }
}
