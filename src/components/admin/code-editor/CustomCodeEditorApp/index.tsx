import React from 'react';
import AdminNavApp from '@/components/admin/shared/AdminNavApp';
import {ADMIN_URLS, PUBLIC_URLS, escapeHtml} from "@/shared/StringUtils";
import {showToast} from "@/client/ToastUtils";
import Requests from "@/client/requests";
import clsx from "clsx";
import ExternalLink from "@/components/admin/shared/ExternalLink";
import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";
import {
  CODE_TYPES, CODE_FILES,
  SETTINGS_CATEGORIES,
} from "@/shared/Constants";
import AdminSelect from "@/components/admin/shared/AdminSelect";
import {readJsonScript} from "@/client/BrowserUtils";

const SUBMIT_STATUS__START = 1;

const CODE_TYPE_SELECTOR_OPTIONS = [
  {
    label: 'Shared html code',
    value: CODE_TYPES.SHARED,
  },
  {
    label: 'Theme: custom',
    value: CODE_TYPES.THEMES,
    theme: 'custom',
  },
];
const CODE_TYPE_SELECTOR_OPTIONS_DICT = Object.assign({}, ...CODE_TYPE_SELECTOR_OPTIONS.map(
  (x: any) => ({[x.value]: x})));

function TabButton({name, onClick, selected}: any) {
  return (<a
    href="#"
    onClick={(e: any) => {
      e.preventDefault();
      onClick();
    }}
  >
    <span
      className={clsx('py-2 px-3', selected ?
        'bg-helper-color text-white hover:text-white' : '')}
    >{name}</span>
  </a>);
}

const CODE_FILES_DICT = {
  [CODE_FILES.WEB_FEED]: {
    name: 'Web Feed',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is used for <a href={PUBLIC_URLS.webFeed()} target="_blank">the public homepage of this site</a>.
    </div>),
  },
  [CODE_FILES.WEB_ITEM]: {
    'name': 'Web Item',
    language: 'html',
    viewUrl: (feed: any) => getFirstItemUrl(feed),
    description: <div>The code is used for an item web page, which is good for SEO.</div>,
  },
  [CODE_FILES.WEB_HEADER]: {
    name: 'Web Header',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is inserted right before the <span
        dangerouslySetInnerHTML={{__html: escapeHtml('</head>')}} /> tag. You can put custom css or javascript code here.
    </div>),
  },
  [CODE_FILES.WEB_BODY_START]: {
    'name': 'Web Body Start',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is inserted right after the <span
      dangerouslySetInnerHTML={{__html: escapeHtml('<body>')}}/> tag. You can put navigation menus / branding things here.
    </div>),
  },
  [CODE_FILES.WEB_BODY_END]: {
    'name': 'Web Body End',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is inserted right before the <span
      dangerouslySetInnerHTML={{__html: escapeHtml('</body>')}} /> tag. You can put links / footer / copyright here.
    </div>),
  },
  [CODE_FILES.RSS_STYLESHEET]: {
    name: 'Rss Stylesheet',
    language: 'css',
    viewUrl: () => PUBLIC_URLS.rssFeed(),
    description: (<div>The code is used for <a href={PUBLIC_URLS.rssFeedStylesheet()} target="_blank">
      {PUBLIC_URLS.rssFeedStylesheet()}</a>, which is included in <a
      href={PUBLIC_URLS.rssFeed()} target="_blank">the RSS feed</a>.</div>),
  },
};

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

function CodeTabs({codeFile, codeType, themeName, setState}: any) {
  const codeFiles = CODE_BUNDLE[codeType];
  return (<div className="lh-page-card mb-4">
    {(codeFiles as any).map((cf: any) => (<TabButton
      key={`tab-${cf}`}
      name={(CODE_FILES_DICT[cf] as any).name}
      selected={codeFile === cf}
      onClick={() => {
        setState({codeFile: cf});
        updateUrlParams(codeType, cf, themeName, true)
      }}
    />))}
  </div>);
}

function getFirstItemUrl(feed: any) {
  const {items} = feed;
  if (items && items.length > 0) {
    const item = items[0];
    return PUBLIC_URLS.webItem(item.id, item.title || 'Untitled');
  }
  return '/'
}

function updateUrlParams(codeType: any, codeFile: any, theme: any = '', push: any = true) {
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

function chooseFileType(codeType: any, url: any = null) {
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

export default class CustomCodeEditorApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.setState = this.setState.bind(this);

    const themeTmplJson = readJsonScript<any>('theme-tmpl-json');
    const feed = readJsonScript<any>('feed-content');
    const onboardingResult = readJsonScript('onboarding-result');

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
    window.addEventListener('hashchange', (event: any) => {
      const {codeType} = this.state;
      const newCodeFile = chooseFileType(codeType, event.newURL);
      this.setState({codeFile: newCodeFile});
    });
  }

  onUpdateFeed(themeTmpls: any, onSucceed: any) {
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
        // TODO: if we support multiple themes, then don't set currentTheme here.
        currentTheme: themeName,
        [CODE_TYPES.THEMES]: {
          ...existingThemes,
          [themeName]: {
            ...themeTmpls,
          }
        },
      };
    }
    this.setState((prevState: any) => ({
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
    }), () => onSucceed())
  }

  onSubmit(e: any) {
    e.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});

    const {codeType} = this.state;

    const themeTmpls = {};
    (CODE_BUNDLE[codeType] as any).forEach((codeFile: any) => {
      (themeTmpls as any)[codeFile] = this.state[codeFile] || '';
    });

    this.onUpdateFeed(themeTmpls, () => {
      Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {settings: {
        [SETTINGS_CATEGORIES.CUSTOM_CODE]: this.state.feed.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]}})
        .then(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Updated!', 'success');
          });
        }).catch((error: any) => {
        this.setState({submitStatus: null}, () => {
          if (!error.response) {
            showToast('Network error. Please refresh the page and try again.', 'error');
          } else {
            showToast('Failed. Please try again.', 'error');
          }
        });
        });
    });
  }

  render() {
    const {codeFile, submitStatus, feed, codeType, themeName, onboardingResult, changed} = this.state;
    const code = this.state[codeFile];
    const codeBundle = CODE_FILES_DICT[codeFile];
    const language = (codeBundle as any).language;
    const viewUrl = (codeBundle as any).viewUrl(feed);
    const description = (codeBundle as any).description;

    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp
      currentPage="settings"
      onboardingResult={onboardingResult}
      upperLevel={{name: 'Settings', url: ADMIN_URLS.settings(), childName: 'Code Editor'}}
      AccessoryComponent={<div className="ml-4">
        <AdminSelect
          value={CODE_TYPE_SELECTOR_OPTIONS_DICT[codeType]}
          options={CODE_TYPE_SELECTOR_OPTIONS}
          onChange={(selected: any) => {
            location.href = `${ADMIN_URLS.codeEditorSettings()}?type=${selected.value}${selected.theme ? `&theme=${selected.theme}` : ''}`;
          }}
        />
      </div>}
    >
      <CodeTabs codeFile={codeFile} setState={this.setState} codeType={codeType} themeName={themeName} />
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="text-xs text-muted-color mb-4">{description}</div>
          <AdminCodeEditor
            code={code}
            language={language}
            onChange={(e: any) => this.setState({[codeFile]: e.target.value, changed: true})}
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
                {submitting ? 'Updating...' : 'Update'}
              </button>
            </div>
            <div className="lh-page-card mt-4 flex flex-col items-center">
              <ExternalLink url={viewUrl} text="View live page"/>
              <div className="text-muted-color text-xs">{viewUrl}</div>
            </div>
            <div className="lh-page-card mt-4">
              <div className="lh-page-subtitle">Pro-tips:</div>
              <ul className="text-helper-text text-xs">
                <li className="mb-2">You can use variables from the <a href={PUBLIC_URLS.jsonFeed()}> json feed</a>.</li>
                <li className="mb-2">The template system is <a href="https://mustache.github.io/">mustache</a>.</li>
                <li className="mb-2">See the OpenAPI spec for the json feed: <a href={PUBLIC_URLS.jsonFeedOpenApiYaml()}>
                  YAML</a> or <a href={PUBLIC_URLS.jsonFeedOpenApiHtml()}>HTML</a>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
