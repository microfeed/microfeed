import React from 'react';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import {ADMIN_URLS, PUBLIC_URLS, escapeHtml} from '@/shared/StringUtils';
import {showToast} from '@/client/ToastUtils';
import Requests from '@/client/requests';
import ExternalLink from '@/components/admin/shared/ExternalLink';
import AdminCodeEditor from '@/components/admin/shared/AdminCodeEditor';
import {CODE_FILES, SETTINGS_CATEGORIES} from '@/shared/Constants';
import {preventCloseWhenChanged} from '@/client/BrowserUtils';
import type {FeedContent} from '@/types';
import {Button} from '@/components/ui/button';

const SUBMIT_STATUS__START = 1;

const CODE_BUNDLE = ['webHeader', 'webBodyStart', 'webBodyEnd'] as const;

type SharedCodeFile = (typeof CODE_BUNDLE)[number];

interface SharedCodeFileDetails {
  description: React.ReactNode;
  language: string;
  name: string;
  viewUrl: () => string;
}

const CODE_FILES_DICT: Record<SharedCodeFile, SharedCodeFileDetails> = {
  webHeader: {
    name: 'Web Header',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is inserted right before the <span
        dangerouslySetInnerHTML={{__html: escapeHtml('</head>')}} /> tag. You can put custom CSS or JavaScript code here.
    </div>),
  },
  webBodyStart: {
    name: 'Web Body Start',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is inserted right after the <span
        dangerouslySetInnerHTML={{__html: escapeHtml('<body>')}} /> tag. You can put navigation menus or branding here.
    </div>),
  },
  webBodyEnd: {
    name: 'Web Body End',
    language: 'html',
    viewUrl: () => PUBLIC_URLS.webFeed(),
    description: (<div>
      The code is inserted right before the <span
        dangerouslySetInnerHTML={{__html: escapeHtml('</body>')}} /> tag. You can put links, a footer, or copyright here.
    </div>),
  },
};

function TabButton({name, onClick, selected}: {
  name: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (<Button
    type="button"
    size="sm"
    variant={selected ? 'default' : 'ghost'}
    onClick={onClick}
  >{name}</Button>);
}

function updateUrlHash(codeFile: SharedCodeFile, push = true) {
  const url = new URL(window.location.href);
  url.hash = codeFile;
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (push) {
    window.history.pushState(null, '', nextUrl);
  } else {
    window.history.replaceState(null, '', nextUrl);
  }
}

function chooseFileType(url?: string): SharedCodeFile {
  const hash = url ? new URL(url).hash : window.location.hash;
  const requested = hash.startsWith('#') ? hash.substring(1) : hash;
  if ((CODE_BUNDLE as readonly string[]).includes(requested)) {
    return requested as SharedCodeFile;
  }
  return 'webHeader';
}

function CodeTabs({codeFile, setCodeFile}: {
  codeFile: SharedCodeFile;
  setCodeFile: (codeFile: SharedCodeFile) => void;
}) {
  return (<div className="mb-4 flex flex-wrap gap-1 rounded-[14px] border bg-card p-3 text-card-foreground shadow-xs">
    {CODE_BUNDLE.map((file) => (<TabButton
      key={`tab-${file}`}
      name={CODE_FILES_DICT[file].name}
      selected={codeFile === file}
      onClick={() => setCodeFile(file)}
    />))}
  </div>);
}

export interface ThemeTemplate {
  webBodyEnd: string;
  webBodyStart: string;
  webHeader: string;
}

interface Props {
  feedContent: FeedContent;
  themeTemplate: ThemeTemplate;
}

interface State extends ThemeTemplate {
  changed: boolean;
  codeFile: SharedCodeFile;
  feed: FeedContent;
  submitStatus: number | null;
}

export default class CustomCodeEditorApp extends React.Component<Props, State> {
  private cleanupNavigationGuard?: () => void;
  private readonly onHashChange = (event: HashChangeEvent) => {
    this.setState({codeFile: chooseFileType(event.newURL)});
  };

  constructor(props: Props) {
    super(props);
    this.onSubmit = this.onSubmit.bind(this);

    this.state = {
      ...props.themeTemplate,
      codeFile: chooseFileType(),
      submitStatus: null,
      feed: props.feedContent,
      changed: false,
    };
  }

  componentDidMount() {
    this.cleanupNavigationGuard = preventCloseWhenChanged(() => this.state.changed);
    window.addEventListener('hashchange', this.onHashChange);
    updateUrlHash(this.state.codeFile, false);
  }

  componentWillUnmount() {
    this.cleanupNavigationGuard?.();
    window.removeEventListener('hashchange', this.onHashChange);
  }

  codeValue(codeFile: SharedCodeFile) {
    switch (codeFile) {
      case 'webBodyEnd':
        return this.state.webBodyEnd;
      case 'webBodyStart':
        return this.state.webBodyStart;
      case 'webHeader':
        return this.state.webHeader;
    }
  }

  updateCode(codeFile: SharedCodeFile, value: string) {
    switch (codeFile) {
      case 'webBodyEnd':
        this.setState({webBodyEnd: value, changed: true});
        break;
      case 'webBodyStart':
        this.setState({webBodyStart: value, changed: true});
        break;
      case 'webHeader':
        this.setState({webHeader: value, changed: true});
        break;
    }
  }

  onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    this.setState({submitStatus: SUBMIT_STATUS__START});

    const sharedTemplates = {
      [CODE_FILES.WEB_HEADER]: this.state.webHeader || '',
      [CODE_FILES.WEB_BODY_START]: this.state.webBodyStart || '',
      [CODE_FILES.WEB_BODY_END]: this.state.webBodyEnd || '',
    };

    this.setState((prevState) => {
      const previousSettings = prevState.feed.settings ?? {};
      const storedCustomCode = previousSettings[SETTINGS_CATEGORIES.CUSTOM_CODE];
      const previousCustomCode = storedCustomCode && typeof storedCustomCode === 'object'
        ? storedCustomCode
        : {};
      return {
        changed: true,
        feed: {
          ...prevState.feed,
          settings: {
            ...previousSettings,
            [SETTINGS_CATEGORIES.CUSTOM_CODE]: {
              ...previousCustomCode,
              ...sharedTemplates,
            },
          },
        },
      };
    }, () => {
      const settings = this.state.feed.settings ?? {};
      Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {settings: {
        [SETTINGS_CATEGORIES.CUSTOM_CODE]: settings[SETTINGS_CATEGORIES.CUSTOM_CODE],
      }}).then(() => {
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
    const {codeFile, submitStatus, changed} = this.state;
    const code = this.codeValue(codeFile);
    const codeBundle = CODE_FILES_DICT[codeFile];
    const viewUrl = codeBundle.viewUrl();
    const submitting = submitStatus === SUBMIT_STATUS__START;

    return (<AdminPageApp>
      <CodeTabs
        codeFile={codeFile}
        setCodeFile={(file) => {
          this.setState({codeFile: file});
          updateUrlHash(file);
        }}
      />
      <form className="grid grid-cols-1 gap-4 xl:grid-cols-12" onSubmit={this.onSubmit}>
        <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs xl:col-span-9">
          <div className="mb-4 text-xs text-muted-foreground">{codeBundle.description}</div>
          <AdminCodeEditor
            code={code}
            language={codeBundle.language}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => this.updateCode(
              codeFile,
              event.target.value,
            )}
          />
        </div>
        <div className="xl:col-span-3">
          <div className="grid gap-4 xl:sticky xl:top-20">
            <div className="rounded-[14px] border bg-card p-5 text-center text-card-foreground shadow-xs">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting || !changed}
              >
                {submitting ? 'Updating...' : 'Update'}
              </Button>
            </div>
            <div className="flex flex-col items-center rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
              <ExternalLink url={viewUrl} text="View live page" />
              <div className="break-all text-center text-xs text-muted-foreground">{viewUrl}</div>
            </div>
            <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
              <div className="mb-2 text-sm font-semibold">Pro-tips:</div>
              <ul className="text-xs text-muted-foreground">
                <li className="mb-2">Shared code wraps every installed theme.</li>
                <li className="mb-2">Save here only changes the three shared HTML slots.</li>
                <li>Manage page templates and RSS styling in Settings → Themes.</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </AdminPageApp>);
  }
}
