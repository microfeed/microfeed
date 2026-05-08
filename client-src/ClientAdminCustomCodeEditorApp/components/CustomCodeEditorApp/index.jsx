import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS, PUBLIC_URLS, escapeHtml, unescapeHtml} from "../../../../common-src/StringUtils";
import {showToast} from "../../../common/ToastUtils";
import Requests from "../../../common/requests";
import clsx from "clsx";
import ExternalLink from "../../../components/ExternalLink";
import AdminCodeEditor from "../../../components/AdminCodeEditor";
import {
  CODE_TYPES, CODE_FILES,
  SETTINGS_CATEGORIES,
} from "../../../../common-src/Constants";
import AdminSelect from "../../../components/AdminSelect";
import {pickDocumentText} from "../../../common/LanguageUtils";

const SUBMIT_STATUS__START = 1;

function getCodeTypeSelectorOptions() {
  return [
    {
      label: pickDocumentText('共用 HTML 代码', 'Shared html code'),
      value: CODE_TYPES.SHARED,
    },
    {
      label: pickDocumentText('主题：custom', 'Theme: custom'),
      value: CODE_TYPES.THEMES,
      theme: 'custom',
    },
  ];
}

function TabButton({name, onClick, selected}) {
  return (<a
    href="#"
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
  >
    <span
      className={clsx('py-2 px-3', selected ? 'bg-helper-color text-white hover:text-white' : '')}
    >{name}</span>
  </a>);
}

function getCodeFilesDict() {
  return {
    [CODE_FILES.WEB_FEED]: {
      name: pickDocumentText('网页 Feed', 'Web Feed'),
      language: 'html',
      viewUrl: () => PUBLIC_URLS.webFeed(),
      description: (<div>
        {pickDocumentText('这段代码用于 ', 'The code is used for ')}<a href={PUBLIC_URLS.webFeed()} target="_blank">{pickDocumentText('站点的公开首页', 'the public homepage of this site')}</a>{pickDocumentText('。', '.')}
      </div>),
    },
    [CODE_FILES.WEB_ITEM]: {
      name: pickDocumentText('网页条目页', 'Web Item'),
      language: 'html',
      viewUrl: (feed) => getFirstItemUrl(feed),
      description: <div>{pickDocumentText('这段代码用于单条内容页，对 SEO 更友好。', 'The code is used for an item web page, which is good for SEO.')}</div>,
    },
    [CODE_FILES.WEB_HEADER]: {
      name: pickDocumentText('网页 Header', 'Web Header'),
      language: 'html',
      viewUrl: () => PUBLIC_URLS.webFeed(),
      description: (<div>
        {pickDocumentText('这段代码会插入到 ', 'The code is inserted right before the ')}<span
          dangerouslySetInnerHTML={{__html: escapeHtml('</head>')}} />{pickDocumentText(' 标签之前。你可以在这里放自定义 CSS 或 JavaScript。', ' tag. You can put custom css or javascript code here.')}
      </div>),
    },
    [CODE_FILES.WEB_BODY_START]: {
      name: pickDocumentText('网页 Body 开始', 'Web Body Start'),
      language: 'html',
      viewUrl: () => PUBLIC_URLS.webFeed(),
      description: (<div>
        {pickDocumentText('这段代码会插入到 ', 'The code is inserted right after the ')}<span
        dangerouslySetInnerHTML={{__html: escapeHtml('<body>')}}/>{pickDocumentText(' 标签之后。你可以在这里放导航、品牌内容等。', ' tag. You can put navigation menus / branding things here.')}
      </div>),
    },
    [CODE_FILES.WEB_BODY_END]: {
      name: pickDocumentText('网页 Body 结束', 'Web Body End'),
      language: 'html',
      viewUrl: () => PUBLIC_URLS.webFeed(),
      description: (<div>
        {pickDocumentText('这段代码会插入到 ', 'The code is inserted right before the ')}<span
        dangerouslySetInnerHTML={{__html: escapeHtml('</body>')}} />{pickDocumentText(' 标签之前。你可以在这里放链接、页脚、版权信息等。', ' tag. You can put links / footer / copyright here.')}
      </div>),
    },
    [CODE_FILES.RSS_STYLESHEET]: {
      name: pickDocumentText('RSS 样式表', 'Rss Stylesheet'),
      language: 'css',
      viewUrl: () => PUBLIC_URLS.rssFeed(),
      description: (<div>{pickDocumentText('这段代码用于 ', 'The code is used for ')}<a href={PUBLIC_URLS.rssFeedStylesheet()} target="_blank">
        {PUBLIC_URLS.rssFeedStylesheet()}</a>{pickDocumentText('，它会被包含进 ', ', which is included in ')}<a
        href={PUBLIC_URLS.rssFeed()} target="_blank">RSS feed</a>{pickDocumentText('。', '.')}</div>),
    },
  };
}

const CODE_BUNDLE = {
  [CODE_TYPES.SHARED]: [
    CODE_FILES.WEB_HEADER,
    CODE_FILES.WEB_BODY_START,
    CODE_FILES.WEB_BODY_END,
  ],
  [CODE_TYPES.THEMES]: [
    CODE_FILES.WEB_FEED,
    CODE_FILES.WEB_ITEM,
    CODE_FILES.WEB_HEADER,
    CODE_FILES.WEB_BODY_START,
    CODE_FILES.WEB_BODY_END,
    CODE_FILES.RSS_STYLESHEET,
  ],
};

function CodeTabs({codeFile, codeType, themeName, setState, codeFilesDict}) {
  const codeFiles = CODE_BUNDLE[codeType];
  return (<div className="lh-page-card mb-4">
    {codeFiles.map((cf) => (<TabButton
      key={`tab-${cf}`}
      name={codeFilesDict[cf].name}
      selected={codeFile === cf}
      onClick={() => {
        setState({codeFile: cf});
        updateUrlParams(codeType, cf, themeName, true);
      }}
    />))}
  </div>);
}

function getFirstItemUrl(feed) {
  const {items} = feed;
  if (items && items.length > 0) {
    const item = items[0];
    return PUBLIC_URLS.webItem(item.id, item.title || pickDocumentText('未命名', 'Untitled'));
  }
  return '/';
}

function updateUrlParams(codeType, codeFile, theme = '', push = true) {
  if ('URLSearchParams' in window) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('type', codeType);
    if (codeType === CODE_TYPES.THEMES) {
      searchParams.set('theme', theme);
    }
    const newRelativePathQuery = `${window.location.pathname}?${searchParams.toString()}${codeFile ? `#${codeFile}` : ''}`;
    if (push) {
      history.pushState(null, '', newRelativePathQuery);
    } else {
      history.replaceState(null, '', newRelativePathQuery);
    }
  }
}

function chooseCodeType() {
  const urlObj = new URL(location.href);
  const {searchParams} = urlObj;
  const codeType = searchParams.get('type') || CODE_TYPES.SHARED;
  if (Object.values(CODE_TYPES).includes(codeType)) {
    return codeType;
  }
  return CODE_TYPES.SHARED;
}

function chooseFileType(codeType, url = null) {
  const {hash} = url ? new URL(url) : window.location;
  let codeFile = codeType === CODE_TYPES.THEMES ? CODE_FILES.WEB_FEED : CODE_FILES.WEB_HEADER;
  if (hash) {
    const hashValue = hash.substring(1);
    if (CODE_BUNDLE[codeType] && CODE_BUNDLE[codeType].includes(hashValue)) {
      codeFile = hashValue;
    }
  }
  return codeFile;
}

export default class CustomCodeEditorApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.setState = this.setState.bind(this);

    const themeTmplJson = JSON.parse(unescapeHtml(document.getElementById('theme-tmpl-json').innerHTML));
    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const onboardingResult = JSON.parse(unescapeHtml(document.getElementById('onboarding-result').innerHTML));

    const {
      themeName,
      rssStylesheet,
      webItem,
      webFeed,
      webBodyStart,
      webBodyEnd,
      webHeader,
    } = themeTmplJson;

    const codeType = chooseCodeType();
    const codeFile = chooseFileType(codeType);

    updateUrlParams(codeType, codeFile, themeName, false);

    this.state = {
      codeType,
      codeFile,
      submitStatus: null,
      changed: false,
      themeName,
      rssStylesheet,
      webItem,
      webFeed,
      webBodyStart,
      webBodyEnd,
      webHeader,
      feed,
      onboardingResult,
    };
  }

  componentDidMount() {
    window.addEventListener('hashchange', (event) => {
      const {codeType} = this.state;
      const newCodeFile = chooseFileType(codeType, event.newURL);
      this.setState({codeFile: newCodeFile});
    });
  }

  onUpdateFeed(themeTmpls, onSucceed) {
    const existingCode = this.state.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE] || {};
    const existingThemes = existingCode[CODE_TYPES.THEMES] || {};

    const {themeName, codeType} = this.state;
    let customCode = {};
    if (codeType === CODE_TYPES.SHARED) {
      customCode = {
        ...themeTmpls,
      };
    } else if (codeType === CODE_TYPES.THEMES) {
      customCode = {
        currentTheme: themeName,
        [CODE_TYPES.THEMES]: {
          ...existingThemes,
          [themeName]: {
            ...themeTmpls,
          }
        },
      };
    }
    this.setState(prevState => ({
      changed: true,
      feed: {
        ...prevState.feed,
        settings: {
          ...prevState.feed.settings,
          [SETTINGS_CATEGORIES.CUSTOM_CODE]: {
            ...prevState.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE],
            ...customCode,
          },
        }
      },
    }), () => onSucceed());
  }

  onSubmit(e) {
    e.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});

    const {codeType} = this.state;
    const themeTmpls = {};
    CODE_BUNDLE[codeType].forEach((codeFile) => {
      themeTmpls[codeFile] = this.state[codeFile] || '';
    });

    this.onUpdateFeed(themeTmpls, () => {
      Requests.axiosPost('/admin/ajax/feed/', {settings: {
        [SETTINGS_CATEGORIES.CUSTOM_CODE]: this.state.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]}})
        .then(() => {
          this.setState({submitStatus: null, changed: false}, () => {
            showToast(pickDocumentText('更新成功！', 'Updated!'), 'success');
          });
        }).catch((error) => {
          this.setState({submitStatus: null}, () => {
            if (!error.response) {
              showToast(pickDocumentText('网络错误，请刷新页面后重试。', 'Network error. Please refresh the page and try again.'), 'error');
            } else {
              showToast(pickDocumentText('更新失败，请重试。', 'Failed. Please try again.'), 'error');
            }
          });
        });
    });
  }

  render() {
    const {codeFile, submitStatus, feed, codeType, themeName, onboardingResult, changed} = this.state;
    const codeTypeSelectorOptions = getCodeTypeSelectorOptions();
    const codeTypeSelectorOptionsDict = Object.assign({}, ...codeTypeSelectorOptions.map((x) => ({[x.value]: x})));
    const codeFilesDict = getCodeFilesDict();
    const code = this.state[codeFile];
    const codeBundle = codeFilesDict[codeFile];
    const language = codeBundle.language;
    const viewUrl = codeBundle.viewUrl(feed);
    const description = codeBundle.description;

    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp
      currentPage="settings"
      onboardingResult={onboardingResult}
      language={feed.channel.language}
      upperLevel={{name: pickDocumentText('设置', 'Settings'), url: ADMIN_URLS.settings(), childName: pickDocumentText('代码编辑器', 'Code Editor')}}
      AccessoryComponent={<div className="ml-4">
        <AdminSelect
          value={codeTypeSelectorOptionsDict[codeType]}
          options={codeTypeSelectorOptions}
          onChange={(selected) => {
            location.href = `${ADMIN_URLS.codeEditorSettings()}?type=${selected.value}${selected.theme ? `&theme=${selected.theme}` : ''}`;
          }}
        />
      </div>}
    >
      <CodeTabs codeFile={codeFile} setState={this.setState} codeType={codeType} themeName={themeName} codeFilesDict={codeFilesDict} />
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="text-xs text-muted-color mb-4">{description}</div>
          <AdminCodeEditor
            code={code}
            language={language}
            onChange={(e) => this.setState({[codeFile]: e.target.value, changed: true})}
          />
        </div>
        <div className="col-span-3">
          <div className="sticky top-8">
            <div className="text-center lh-page-card">
              <button
                type="submit"
                className="lh-btn lh-btn-brand-dark lh-btn-lg"
                onClick={this.onSubmit}
                disabled={submitting || !changed}
              >
                {submitting ? pickDocumentText('更新中...', 'Updating...') : pickDocumentText('更新', 'Update')}
              </button>
            </div>
            <div className="lh-page-card mt-4 flex flex-col items-center">
              <ExternalLink url={viewUrl} text={pickDocumentText('查看线上页面', 'View live page')}/>
              <div className="text-muted-color text-xs">{viewUrl}</div>
            </div>
            <div className="lh-page-card mt-4">
              <div className="lh-page-subtitle">{pickDocumentText('提示：', 'Pro-tips:')}</div>
              <ul className="text-helper-text text-xs">
                <li className="mb-2">{pickDocumentText('你可以使用 ', 'You can use variables from the ')}<a href={PUBLIC_URLS.jsonFeed()}>JSON feed</a>{pickDocumentText(' 里的变量。', '.')}</li>
                <li className="mb-2">{pickDocumentText('模板系统使用的是 ', 'The template system is ')}<a href="https://mustache.github.io/">mustache</a>。</li>
                <li className="mb-2">{pickDocumentText('JSON feed 的 OpenAPI 说明见：', 'See the OpenAPI spec for the json feed: ')}<a href={PUBLIC_URLS.jsonFeedOpenApiYaml()}>
                  YAML</a> {pickDocumentText('或', 'or')} <a href={PUBLIC_URLS.jsonFeedOpenApiHtml()}>HTML</a>。</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
