import React from 'react';
import {navigate} from 'astro:transitions/client';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import CodeEditorRouteSelect from '@/components/admin/code-editor/CodeEditorRouteSelect';
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
import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import type {FeedContent} from "@/types";

const SUBMIT_STATUS__START = 1;

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
    if (codeType !== CODE_TYPES.SHARED || searchParams.has('type')) {
      searchParams.set('type', codeType);
    }
    if (codeType === CODE_TYPES.THEMES) {
      searchParams.set('theme', theme);
    }
    const queryString = searchParams.toString();
    const newRelativePathQuery = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${codeFile ? `#${codeFile}` : ''}`;
    void navigate(newRelativePathQuery, {history: push ? 'push' : 'replace'});
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

export interface ThemeTemplate {
  rssStylesheet: string;
  themeName: string;
  webBodyEnd: string;
  webBodyStart: string;
  webFeed: string;
  webHeader: string;
  webItem: string;
}

interface Props {
  feedContent: FeedContent;
  themeTemplate: ThemeTemplate;
}

export default class CustomCodeEditorApp extends React.Component<Props, any> {
  private cleanupNavigationGuard?: () => void;
  private readonly onHashChange = (event: HashChangeEvent) => {
    const {codeType} = this.state;
    const newCodeFile = chooseFileType(codeType, event.newURL);
    this.setState({codeFile: newCodeFile});
  };

  constructor(props: Props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.setState = this.setState.bind(this);

    const themeTmplJson = props.themeTemplate;
    const feed = props.feedContent;

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
      changed: false,
    };
  }

  componentDidMount() {
    this.cleanupNavigationGuard = preventCloseWhenChanged(() => this.state.changed);
    window.addEventListener('hashchange', this.onHashChange);
    const {codeType, codeFile, themeName} = this.state;
    updateUrlParams(codeType, codeFile, themeName, false);
  }

  componentWillUnmount() {
    this.cleanupNavigationGuard?.();
    window.removeEventListener('hashchange', this.onHashChange);
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
          this.setState({submitStatus: null, changed: false}, () => {
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
    const {codeFile, submitStatus, feed, codeType, themeName, changed} = this.state;
    const code = this.state[codeFile];
    const codeBundle = CODE_FILES_DICT[codeFile];
    const language = (codeBundle as any).language;
    const viewUrl = (codeBundle as any).viewUrl(feed);
    const description = (codeBundle as any).description;

    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminPageApp>
      <CodeEditorRouteSelect className="mb-4 lg:hidden" codeType={codeType} />
      <CodeTabs codeFile={codeFile} setState={this.setState} codeType={codeType} themeName={themeName} />
      <form className="grid grid-cols-12 gap-4" onSubmit={this.onSubmit}>
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
    </AdminPageApp>);
  }
}
