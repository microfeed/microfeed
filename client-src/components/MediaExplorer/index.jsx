import React from 'react';
import clsx from 'clsx';
import {
  TrashIcon, PencilSquareIcon, ArrowPathIcon, ArrowUpTrayIcon, ArrowsRightLeftIcon,
  MagnifyingGlassIcon, FolderIcon, PhotoIcon, MusicalNoteIcon, VideoCameraIcon,
  DocumentIcon, HomeIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Requests from '../../common/requests';
import {ADMIN_URLS, unescapeHtml, urlJoinWithRelative, randomHex} from '../../../common-src/StringUtils';
import {showToast} from '../../common/ToastUtils';

export function readPublicBucketUrl() {
  try {
    const $feedContent = document.getElementById('feed-content');
    if (!$feedContent) {
      return '';
    }
    const feedContent = JSON.parse(unescapeHtml($feedContent.innerHTML));
    const webGlobalSettings = (feedContent.settings && feedContent.settings.webGlobalSettings) || {};
    return webGlobalSettings.publicBucketUrl || '';
  } catch (e) {
    return '';
  }
}

function fullUrl(publicBucketUrl, internalUrl) {
  if (!internalUrl) {
    return '';
  }
  if (/^https?:\/\//i.test(internalUrl)) {
    return internalUrl;
  }
  return urlJoinWithRelative(publicBucketUrl, internalUrl);
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const CATEGORY_ICON = {
  image: PhotoIcon,
  audio: MusicalNoteIcon,
  video: VideoCameraIcon,
  document: DocumentIcon,
  other: DocumentIcon,
};

// Strip the project/env prefix from a full key to get the folder-relative path.
function toRelative(key, pathPrefix) {
  if (!key) {
    return '';
  }
  if (pathPrefix && key.startsWith(`${pathPrefix}/`)) {
    return key.slice(pathPrefix.length + 1);
  }
  return key;
}

function dirOf(relPath) {
  const idx = relPath.lastIndexOf('/');
  return idx < 0 ? '' : relPath.slice(0, idx);
}

const UPLOAD_FOLDER = 'images'; // manager uploads land in images/ (per project decision)

export default class MediaExplorer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      items: [],
      pathPrefix: '',
      loading: true,
      currentPath: '',
      query: '',
      unusedOnly: false,
      categoryFilter: 'all',
      selectedIds: {},
      deleting: false,
      reconciling: false,
      uploading: false,
      uploadProgress: 0,
      confirmDelete: null,
      renaming: null,
      renameTitle: '',
      savingRename: false,
      replacingId: null,
      publicBucketUrl: readPublicBucketUrl(),
    };
    this.load = this.load.bind(this);
    this.onReconcile = this.onReconcile.bind(this);
    this.onUploadPick = this.onUploadPick.bind(this);
    this.onReplacePick = this.onReplacePick.bind(this);
    this.confirmDelete = this.confirmDelete.bind(this);
    this.onSaveRename = this.onSaveRename.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  load() {
    this.setState({loading: true});
    return Requests.axiosGet(`${ADMIN_URLS.ajaxMediaList()}?limit=2000`)
      .then((res) => {
        this.setState({
          items: (res.data && res.data.results) || [],
          pathPrefix: (res.data && res.data.pathPrefix) || '',
          loading: false,
          selectedIds: {},
          confirmDelete: null,
        });
      })
      .catch(() => {
        this.setState({loading: false});
        showToast('Failed to load media.', 'error');
      });
  }

  onReconcile() {
    this.setState({reconciling: true});
    Requests.axiosPost(ADMIN_URLS.ajaxMediaReconcile(), {})
      .then((res) => {
        const added = (res.data && res.data.added) || [];
        this.setState({reconciling: false});
        showToast(`Synced with storage. ${added.length} new file(s) found.`, 'success');
        this.load();
      })
      .catch(() => {
        this.setState({reconciling: false});
        showToast('Sync failed.', 'error');
      });
  }

  onUploadPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) {
      return;
    }
    let remaining = files.length;
    this.setState({uploading: true, uploadProgress: 0});
    files.forEach((file) => {
      const name = file.name || 'file';
      const dot = name.lastIndexOf('.');
      const ext = dot >= 0 ? name.slice(dot + 1) : '';
      const cdnFilename = `${UPLOAD_FOLDER}/library-${randomHex(32)}${ext ? `.${ext}` : ''}`;
      Requests.upload(
        file,
        cdnFilename,
        (pct) => this.setState({uploadProgress: pct}),
        () => {
          remaining -= 1;
          if (remaining <= 0) {
            this.setState({uploading: false, uploadProgress: 0});
            showToast(`Uploaded ${files.length} file(s).`, 'success');
            this.load();
          }
        },
        () => {
          remaining -= 1;
          this.setState({uploading: remaining > 0});
          showToast('An upload failed.', 'error');
        },
        () => {
          remaining -= 1;
          this.setState({uploading: remaining > 0});
          showToast('An upload failed.', 'error');
        },
      );
    });
  }

  onReplacePick(e, media) {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) {
      return;
    }
    const {pathPrefix} = this.state;
    const relativeKey = toRelative(media.r2_key || media.url, pathPrefix);
    this.setState({replacingId: media.id});
    Requests.replace(
      file,
      relativeKey,
      media.id,
      () => {},
      () => {
        this.setState({replacingId: null});
        showToast('Replaced. All links now point to the new file (may take a moment to refresh from cache).', 'success', 4000);
        this.load();
      },
      () => {
        this.setState({replacingId: null});
        showToast('Replace failed.', 'error');
      },
    );
  }

  toggleSelect(id) {
    this.setState((s) => {
      const selectedIds = {...s.selectedIds};
      if (selectedIds[id]) { delete selectedIds[id]; } else { selectedIds[id] = true; }
      return {selectedIds};
    });
  }

  confirmDelete() {
    const {confirmDelete} = this.state;
    if (!confirmDelete || confirmDelete.ids.length === 0) {
      return;
    }
    this.setState({deleting: true});
    Requests.axiosPost(ADMIN_URLS.ajaxMediaDelete(), {ids: confirmDelete.ids})
      .then((res) => {
        const {deleted = [], refused = []} = res.data || {};
        this.setState({deleting: false, confirmDelete: null});
        if (refused.length > 0) {
          showToast(`${deleted.length} deleted, ${refused.length} skipped (linked/in use).`, 'warning', 4000);
        } else {
          showToast(`${deleted.length} file(s) deleted.`, 'success');
        }
        this.load();
      })
      .catch(() => {
        this.setState({deleting: false, confirmDelete: null});
        showToast('Delete failed.', 'error');
      });
  }

  onSaveRename() {
    const {renaming, renameTitle} = this.state;
    if (!renaming) {
      return;
    }
    this.setState({savingRename: true});
    Requests.axiosPost(ADMIN_URLS.ajaxMediaUpdate(), {id: renaming.id, title: renameTitle})
      .then((res) => {
        const updated = res.data || {};
        this.setState((s) => ({
          savingRename: false,
          renaming: null,
          items: s.items.map((m) => (m.id === renaming.id ? {...m, title: updated.title, slug: updated.slug} : m)),
        }));
        showToast('Renamed.', 'success');
      })
      .catch(() => {
        this.setState({savingRename: false});
        showToast('Rename failed.', 'error');
      });
  }

  // Derive the folders + files visible at the current path, after applying
  // the search / category / unused filters.
  computeView() {
    const {items, pathPrefix, currentPath, query, unusedOnly, categoryFilter} = this.state;
    const q = query.trim().toLowerCase();

    const filtered = items.filter((m) => {
      if (unusedOnly && m.used) { return false; }
      if (categoryFilter !== 'all' && (m.category || 'other') !== categoryFilter) { return false; }
      if (q) {
        const rel = toRelative(m.r2_key || m.url, pathPrefix).toLowerCase();
        return (m.title || '').toLowerCase().includes(q) ||
          (m.slug || '').toLowerCase().includes(q) ||
          (m.original_filename || '').toLowerCase().includes(q) ||
          rel.includes(q);
      }
      return true;
    });

    // When searching, flatten to matching files (ignore folder nesting).
    if (q) {
      return {folders: [], files: filtered, flat: true};
    }

    const prefix = currentPath ? `${currentPath}/` : '';
    const folderSet = {};
    const files = [];
    filtered.forEach((m) => {
      const rel = toRelative(m.r2_key || m.url, pathPrefix);
      if (prefix && !rel.startsWith(prefix)) { return; }
      const rest = rel.slice(prefix.length);
      if (rest.includes('/')) {
        const folderName = rest.slice(0, rest.indexOf('/'));
        if (!folderSet[folderName]) { folderSet[folderName] = {name: folderName, count: 0}; }
        folderSet[folderName].count += 1;
      } else if (rest) {
        files.push(m);
      }
    });
    return {folders: Object.values(folderSet).sort((a, b) => a.name.localeCompare(b.name)), files, flat: false};
  }

  renderBreadcrumbs() {
    const {currentPath} = this.state;
    const segments = currentPath ? currentPath.split('/') : [];
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500 mb-4 flex-wrap">
        <button type="button" className="flex items-center gap-1 hover:text-brand-light" onClick={() => this.setState({currentPath: ''})}>
          <HomeIcon className="w-4 h-4" /> Home
        </button>
        {segments.map((seg, i) => {
          const path = segments.slice(0, i + 1).join('/');
          return (<React.Fragment key={path}>
            <span className="text-gray-300">/</span>
            <button type="button" className="hover:text-brand-light" onClick={() => this.setState({currentPath: path})}>{seg}</button>
          </React.Fragment>);
        })}
      </div>
    );
  }

  render() {
    const {
      loading, query, unusedOnly, categoryFilter, selectedIds, deleting, reconciling,
      uploading, uploadProgress, confirmDelete, renaming, renameTitle, savingRename,
      replacingId, publicBucketUrl, items, currentPath,
    } = this.state;
    const {folders, files, flat} = this.computeView();
    const selectedCount = Object.keys(selectedIds).length;
    const unusedCount = items.filter((m) => !m.used).length;
    const totalSize = items.reduce((sum, m) => sum + (m.size || 0), 0);

    return (<div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            placeholder="Search all files…"
            onChange={(e) => this.setState({query: e.target.value})}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-light/30"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => this.setState({categoryFilter: e.target.value})}
          className="text-sm border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand-light/30"
        >
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="document">Documents</option>
          <option value="other">Other</option>
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" className="accent-brand-light" checked={unusedOnly} onChange={() => this.setState((s) => ({unusedOnly: !s.unusedOnly}))} />
          Unused only
        </label>

        <label className="lh-btn lh-btn-brand-dark flex items-center gap-1 cursor-pointer">
          <ArrowUpTrayIcon className="w-4 h-4" />
          {uploading ? `Uploading ${(uploadProgress * 100).toFixed(0)}%` : 'Upload'}
          <input type="file" multiple className="hidden" onChange={this.onUploadPick} disabled={uploading} />
        </label>
        <button type="button" className="lh-btn lh-btn-secondary flex items-center gap-1" onClick={this.onReconcile} disabled={reconciling}>
          <ArrowPathIcon className={clsx('w-4 h-4', reconciling && 'animate-spin')} />
          {reconciling ? 'Syncing…' : 'Sync'}
        </button>
        {selectedCount > 0 && <button type="button" className="lh-btn lh-btn-red flex items-center gap-1" onClick={() => this.setState({confirmDelete: {ids: Object.keys(selectedIds)}})} disabled={deleting}>
          <TrashIcon className="w-4 h-4" /> Delete ({selectedCount})
        </button>}
      </div>

      {/* Summary */}
      {!loading && <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span><span className="font-semibold text-gray-700">{items.length}</span> files</span>
        <span><span className="font-semibold text-gray-700">{unusedCount}</span> unused</span>
        <span><span className="font-semibold text-gray-700">{formatBytes(totalSize)}</span> total</span>
      </div>}

      {/* Breadcrumbs */}
      {!flat && this.renderBreadcrumbs()}

      {/* Inline delete confirm */}
      {confirmDelete && <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-md bg-red-50 border border-red-200">
        <div className="text-sm text-red-800">
          Delete {confirmDelete.ids.length} file(s)? Linked files are skipped automatically; this permanently removes unlinked files from storage.
        </div>
        <div className="flex gap-2">
          <button type="button" className="lh-btn lh-btn-secondary" onClick={() => this.setState({confirmDelete: null})} disabled={deleting}>Cancel</button>
          <button type="button" className="lh-btn lh-btn-red" onClick={this.confirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>}

      {/* Content */}
      {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({length: 10}).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-100 overflow-hidden animate-pulse">
            <div className="aspect-square bg-gray-100" />
            <div className="p-2"><div className="h-3 bg-gray-100 rounded w-3/4" /></div>
          </div>
        ))}
      </div> : ((folders.length + files.length) === 0 ?
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FolderIcon className="w-12 h-12 mb-3" />
          <div className="text-sm">{query ? 'No files match your search.' : 'This folder is empty.'}</div>
        </div> :
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Folders */}
          {folders.map((f) => (
            <button
              type="button"
              key={`folder-${f.name}`}
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 hover:shadow-md hover:border-brand-light transition-all aspect-square"
              onClick={() => this.setState({currentPath: currentPath ? `${currentPath}/${f.name}` : f.name})}
            >
              <FolderIcon className="w-12 h-12 text-brand-light mb-2" />
              <div className="text-xs font-medium text-gray-700 truncate w-full text-center" title={f.name}>{f.name}</div>
              <div className="text-[10px] text-gray-400">{f.count} item(s)</div>
            </button>
          ))}

          {/* Files */}
          {files.map((m) => {
            const isImage = (m.category || 'other') === 'image';
            const Icon = CATEGORY_ICON[m.category] || DocumentIcon;
            const src = fullUrl(publicBucketUrl, m.url);
            const selected = !!selectedIds[m.id];
            const isReplacing = replacingId === m.id;
            return (<div key={m.id} className={clsx('group relative rounded-lg overflow-hidden border bg-white transition-shadow', selected ? 'ring-2 ring-brand-light border-brand-light' : 'border-gray-200 hover:shadow-md')}>
              <a href={src} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-gray-50 flex items-center justify-center">
                {isImage ? <img src={src} alt={m.title || ''} loading="lazy" className="max-w-full max-h-full object-contain" />
                  : <div className="flex flex-col items-center text-gray-400"><Icon className="w-10 h-10" /><span className="text-[10px] mt-1 uppercase">{m.category || 'file'}</span></div>}
                {isReplacing && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs text-gray-600">Replacing…</div>}
              </a>

              <div className="absolute top-2 left-2">
                <input type="checkbox" className="w-4 h-4 accent-brand-light cursor-pointer" checked={selected} onChange={() => this.toggleSelect(m.id)} />
              </div>

              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <label title="Replace file" className="p-1.5 rounded-md bg-white/90 shadow hover:bg-white text-gray-600 cursor-pointer">
                  <ArrowsRightLeftIcon className="w-4 h-4" />
                  <input type="file" className="hidden" onChange={(e) => this.onReplacePick(e, m)} />
                </label>
                <button type="button" title="Rename" className="p-1.5 rounded-md bg-white/90 shadow hover:bg-white text-gray-600" onClick={() => this.setState({renaming: m, renameTitle: m.title || ''})}>
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                {!m.used && <button type="button" title="Delete" className="p-1.5 rounded-md bg-white/90 shadow hover:bg-red-50 text-red-600" onClick={() => this.setState({confirmDelete: {ids: [m.id]}})}>
                  <TrashIcon className="w-4 h-4" />
                </button>}
              </div>

              <div className="p-2">
                <div className="text-xs font-medium text-gray-800 truncate" title={m.title || ''}>{m.title || 'Untitled'}</div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', m.used ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                    {m.used ? 'Linked' : 'Unused'}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatBytes(m.size)}</span>
                </div>
                {m.used && m.references && m.references.length > 0 && <div className="mt-1 text-[10px] text-gray-400 truncate" title={m.references.map((r) => `${r.type}: ${r.label}`).join(', ')}>
                  in {m.references.map((r) => r.label).join(', ')}
                </div>}
              </div>
            </div>);
          })}
        </div>)}

      {/* Rename modal */}
      {renaming && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => !savingRename && this.setState({renaming: null})}>
        <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
          <div className="font-semibold text-gray-800 mb-3">Rename file</div>
          <input
            type="text"
            autoFocus
            value={renameTitle}
            onChange={(e) => this.setState({renameTitle: e.target.value})}
            onKeyDown={(e) => {if (e.key === 'Enter') this.onSaveRename();}}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-light/30"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="lh-btn lh-btn-secondary flex items-center gap-1" onClick={() => this.setState({renaming: null})} disabled={savingRename}><XMarkIcon className="w-4 h-4" /> Cancel</button>
            <button type="button" className="lh-btn lh-btn-brand-dark flex items-center gap-1" onClick={this.onSaveRename} disabled={savingRename}><CheckIcon className="w-4 h-4" /> {savingRename ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>}
    </div>);
  }
}
