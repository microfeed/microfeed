import React from 'react';
import clsx from 'clsx';
import {TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ArrowPathIcon, MagnifyingGlassIcon, PhotoIcon} from '@heroicons/react/24/outline';
import Requests from '../../common/requests';
import {ADMIN_URLS, unescapeHtml, urlJoinWithRelative} from '../../../common-src/StringUtils';
import {showToast} from '../../common/ToastUtils';

// Read the R2 public bucket url from the feed-content script tag (the same
// source every admin page reads settings from). Media rows store a
// host-stripped, project/env-prefixed url; prefixing the bucket url yields a
// browser-loadable thumbnail src.
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

function MediaTile({media, src, selected, selectMode, manageMode, onOpen, onToggleSelect, onStartRename, onDelete}) {
  return (<div
    className={clsx(
      'group relative rounded-lg overflow-hidden border transition-shadow bg-white',
      selected ? 'ring-2 ring-brand-light border-brand-light' : 'border-gray-200 hover:shadow-md',
    )}
  >
    <div
      className="aspect-square bg-gray-50 flex items-center justify-center cursor-pointer"
      onClick={() => onOpen(media, src)}
    >
      <img src={src} alt={media.title || ''} loading="lazy" className="max-w-full max-h-full object-contain" />
    </div>

    {/* Hover action bar (management mode) */}
    {manageMode && <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        title="Rename"
        className="p-1.5 rounded-md bg-white/90 shadow hover:bg-white text-gray-600"
        onClick={(e) => {e.stopPropagation(); onStartRename(media);}}
      >
        <PencilSquareIcon className="w-4 h-4" />
      </button>
      {!media.used && <button
        type="button"
        title="Delete"
        className="p-1.5 rounded-md bg-white/90 shadow hover:bg-red-50 text-red-600"
        onClick={(e) => {e.stopPropagation(); onDelete(media);}}
      >
        <TrashIcon className="w-4 h-4" />
      </button>}
    </div>}

    {manageMode && <div className="absolute top-2 left-2">
      <input
        type="checkbox"
        className="w-4 h-4 accent-brand-light cursor-pointer"
        checked={selected}
        onChange={(e) => {e.stopPropagation(); onToggleSelect(media.id);}}
      />
    </div>}

    <div className="p-2">
      <div className="text-xs font-medium text-gray-800 truncate" title={media.title || media.slug || ''}>
        {media.title || media.slug || 'Untitled'}
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className={clsx(
          'inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
          media.used ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        )}>
          {media.used ? 'Used' : 'Unused'}
        </span>
        <span className="text-[10px] text-gray-400">{formatBytes(media.size)}</span>
      </div>
      {media.used && media.references && media.references.length > 0 && <div
        className="mt-1 text-[10px] text-gray-400 truncate"
        title={media.references.map((r) => `${r.type}: ${r.label}`).join(', ')}
      >
        in {media.references.map((r) => r.label).join(', ')}
      </div>}
    </div>

    {selectMode && <button
      type="button"
      className="absolute inset-0 bg-brand-dark/0 hover:bg-brand-dark/10 transition-colors"
      onClick={() => onOpen(media, src)}
      aria-label={`Select ${media.title || 'image'}`}
    />}
  </div>);
}

/**
 * Reusable media inventory grid. Backs both the Media Manager page
 * (management mode: multi-select + delete + reconcile + rename + filter) and
 * the "choose from uploaded" picker (select mode: click a tile to pick it).
 */
export default class MediaLibrary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      items: [],
      loading: true,
      unusedOnly: false,
      query: '',
      selectedIds: {},
      deleting: false,
      reconciling: false,
      confirmDelete: null, // {ids} pending confirmation
      renaming: null,       // media row being renamed
      renameTitle: '',
      savingRename: false,
      publicBucketUrl: readPublicBucketUrl(),
    };

    this.load = this.load.bind(this);
    this.onToggleUnused = this.onToggleUnused.bind(this);
    this.onToggleSelect = this.onToggleSelect.bind(this);
    this.requestDelete = this.requestDelete.bind(this);
    this.confirmDelete = this.confirmDelete.bind(this);
    this.onReconcile = this.onReconcile.bind(this);
    this.onOpen = this.onOpen.bind(this);
    this.onStartRename = this.onStartRename.bind(this);
    this.onSaveRename = this.onSaveRename.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  load() {
    const {unusedOnly} = this.state;
    this.setState({loading: true});
    return Requests.axiosGet(`${ADMIN_URLS.ajaxMediaList()}?limit=500&unusedOnly=${unusedOnly}`)
      .then((res) => {
        this.setState({items: (res.data && res.data.results) || [], loading: false, selectedIds: {}, confirmDelete: null});
      })
      .catch(() => {
        this.setState({loading: false});
        showToast('Failed to load media.', 'error');
      });
  }

  onToggleUnused() {
    this.setState((s) => ({unusedOnly: !s.unusedOnly}), this.load);
  }

  onToggleSelect(id) {
    this.setState((s) => {
      const selectedIds = {...s.selectedIds};
      if (selectedIds[id]) {
        delete selectedIds[id];
      } else {
        selectedIds[id] = true;
      }
      return {selectedIds};
    });
  }

  onOpen(media, src) {
    if (this.props.selectMode && this.props.onSelect) {
      this.props.onSelect(src, media);
    }
  }

  requestDelete(idsOrMedia) {
    const ids = Array.isArray(idsOrMedia) ? idsOrMedia : [idsOrMedia.id];
    this.setState({confirmDelete: {ids}});
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
          showToast(`${deleted.length} deleted, ${refused.length} skipped (in use).`, 'warning', 4000);
        } else {
          showToast(`${deleted.length} image(s) deleted.`, 'success');
        }
        this.load();
      })
      .catch(() => {
        this.setState({deleting: false, confirmDelete: null});
        showToast('Delete failed.', 'error');
      });
  }

  onReconcile() {
    this.setState({reconciling: true});
    Requests.axiosPost(ADMIN_URLS.ajaxMediaReconcile(), {})
      .then((res) => {
        const added = (res.data && res.data.added) || [];
        this.setState({reconciling: false});
        showToast(`Synced with storage. ${added.length} new image(s) found.`, 'success');
        this.load();
      })
      .catch(() => {
        this.setState({reconciling: false});
        showToast('Sync failed.', 'error');
      });
  }

  onStartRename(media) {
    this.setState({renaming: media, renameTitle: media.title || ''});
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

  filteredItems() {
    const {items, query} = this.state;
    const {imagesOnly} = this.props;
    const q = query.trim().toLowerCase();
    let rows = items;
    // The inventory now holds every file type; the picker only inserts images.
    if (imagesOnly) {
      rows = rows.filter((m) => (m.category || 'image') === 'image');
    }
    if (!q) {
      return rows;
    }
    return rows.filter((m) =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.slug || '').toLowerCase().includes(q) ||
      (m.original_filename || '').toLowerCase().includes(q));
  }

  render() {
    const {selectMode, manageMode} = this.props;
    const {loading, unusedOnly, query, selectedIds, deleting, reconciling, confirmDelete, renaming, renameTitle, savingRename, publicBucketUrl, items} = this.state;
    const visible = this.filteredItems();
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
            placeholder="Search by name…"
            onChange={(e) => this.setState({query: e.target.value})}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-light/30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" className="accent-brand-light" checked={unusedOnly} onChange={this.onToggleUnused} />
          Unused only
        </label>
        {manageMode && <button
          type="button"
          className="lh-btn lh-btn-secondary flex items-center gap-1"
          onClick={this.onReconcile}
          disabled={reconciling}
        >
          <ArrowPathIcon className={clsx('w-4 h-4', reconciling && 'animate-spin')} />
          {reconciling ? 'Syncing…' : 'Sync with storage'}
        </button>}
        {manageMode && selectedCount > 0 && <button
          type="button"
          className="lh-btn lh-btn-red flex items-center gap-1"
          onClick={() => this.requestDelete(Object.keys(selectedIds))}
          disabled={deleting}
        >
          <TrashIcon className="w-4 h-4" />
          Delete selected ({selectedCount})
        </button>}
      </div>

      {/* Summary counts */}
      {manageMode && !loading && <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span><span className="font-semibold text-gray-700">{items.length}</span> images</span>
        <span><span className="font-semibold text-gray-700">{unusedCount}</span> unused</span>
        <span><span className="font-semibold text-gray-700">{formatBytes(totalSize)}</span> total</span>
      </div>}

      {/* Inline delete confirmation */}
      {confirmDelete && <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-md bg-red-50 border border-red-200">
        <div className="text-sm text-red-800">
          Delete {confirmDelete.ids.length} image(s)? This permanently removes the file(s) from storage.
        </div>
        <div className="flex gap-2">
          <button type="button" className="lh-btn lh-btn-secondary" onClick={() => this.setState({confirmDelete: null})} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="lh-btn lh-btn-red" onClick={this.confirmDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>}

      {/* Grid / states */}
      {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({length: 10}).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-100 overflow-hidden animate-pulse">
            <div className="aspect-square bg-gray-100" />
            <div className="p-2"><div className="h-3 bg-gray-100 rounded w-3/4" /></div>
          </div>
        ))}
      </div> : (visible.length === 0 ?
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <PhotoIcon className="w-12 h-12 mb-3" />
          <div className="text-sm">
            {query ? 'No images match your search.' : (unusedOnly ? 'No unused images.' : 'No images yet.')}
          </div>
        </div> :
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visible.map((m) => (
            <MediaTile
              key={m.id}
              media={m}
              src={fullUrl(publicBucketUrl, m.url)}
              selected={!!selectedIds[m.id]}
              selectMode={selectMode}
              manageMode={manageMode}
              onOpen={this.onOpen}
              onToggleSelect={this.onToggleSelect}
              onStartRename={this.onStartRename}
              onDelete={this.requestDelete}
            />
          ))}
        </div>)}

      {/* Rename inline popover (simple modal) */}
      {renaming && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => !savingRename && this.setState({renaming: null})}>
        <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
          <div className="font-semibold text-gray-800 mb-3">Rename image</div>
          <input
            type="text"
            autoFocus
            value={renameTitle}
            onChange={(e) => this.setState({renameTitle: e.target.value})}
            onKeyDown={(e) => {if (e.key === 'Enter') this.onSaveRename();}}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-light/30"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="lh-btn lh-btn-secondary flex items-center gap-1" onClick={() => this.setState({renaming: null})} disabled={savingRename}>
              <XMarkIcon className="w-4 h-4" /> Cancel
            </button>
            <button type="button" className="lh-btn lh-btn-brand-dark flex items-center gap-1" onClick={this.onSaveRename} disabled={savingRename}>
              <CheckIcon className="w-4 h-4" /> {savingRename ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>}
    </div>);
  }
}
