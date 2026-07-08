import React from "react";
import FormRenderer from "../../../components/FormRenderer";
import AdminInput from "../../../components/AdminInput";
import AdminDialog from "../../../components/AdminDialog";
import { mediaWidgets, tagsWidget, referenceWidget } from "../../../components/FormRenderer/widgets";
import FilterTagsWidget from "../../../components/FormRenderer/widgets/FilterTagsWidget";
import LandingPreview from "../LandingPreview";
import { getFieldDefs, getType } from "../../../../edge-src/registry/ContentTypeRegistry";
import Requests from "../../../common/requests";
import { showToast } from "../../../common/ToastUtils";
import { ADMIN_URLS, toSlug } from "../../../../common-src/StringUtils";
import { getByPath, setByPath } from "../../../common/objectPath";

const SUBMIT_STATUS__START = 1;

const METADATA_FIELD_KEYS = new Set([
  "status",
  "author",
  "excerpt",
  "tags",
  "date_published_ms",
  "seo_title",
  "seo_description",
  "share_image",
  "noindex",
  "content_types",
  "filter_tags",
  "sort",
  "limit",
  "layout",
  "show_in_nav",
  "members",
  "related_items",
  "guid",
  "url",
  "itunes:title",
  "itunes:block",
  "itunes:episodeType",
  "itunes:season",
  "itunes:episode",
  "itunes:explicit",
  "copyright",
  "language",
  "publisher",
  "link",
  "categories",
]);

function isMobileViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(max-width: 767px)").matches;
}

function isMetadataField(fieldDef) {
  return METADATA_FIELD_KEYS.has(fieldDef.key) || fieldDef.key.startsWith("seo_");
}

function splitFieldDefs(fieldDefs) {
  const primaryFieldDefs = [];
  const metadataFieldDefs = [];
  (fieldDefs || []).forEach((fieldDef) => {
    if (isMetadataField(fieldDef)) {
      metadataFieldDefs.push(fieldDef);
    } else {
      primaryFieldDefs.push(fieldDef);
    }
  });
  return {primaryFieldDefs, metadataFieldDefs};
}

function seedPayload(contentType, item) {
  if (!item) {
    return {};
  }
  const fieldDefs = getFieldDefs(contentType);
  let payload = {};
  fieldDefs.forEach((fieldDef) => {
    const value = getByPath(item, fieldDef.feedMapping.source);
    if (value !== undefined) {
      payload = setByPath(payload, fieldDef.feedMapping.source, value);
    }
  });
  return payload;
}

function MetadataPanel({
  payload,
  errors,
  metadataFieldDefs,
  publicBucketUrl,
  showSlug,
  onChange,
}) {
  const slugError = errors.find((err) => err.field === "slug");
  return (
    <div className="grid grid-cols-1 gap-4">
      {showSlug && (
        <div className="lh-page-card">
          <AdminInput
            label="URL slug"
            value={payload.slug || ""}
            placeholder={toSlug(payload.title) || "auto-generated"}
            onChange={(e) => onChange({ ...payload, slug: e.target.value })}
          />
          <div className="text-xs text-gray-400 mt-1">
            {(() => {
              const finalSlug = toSlug(payload.slug) || toSlug(payload.title) || "(auto)";
              return <span>URL: <span className="text-gray-600 font-mono">/{finalSlug}</span></span>;
            })()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Leave blank to generate from the title. On edit, the slug stays fixed unless you change it here.
          </div>
          {slugError && <div className="text-xs text-red-500 mt-2">{slugError.message}</div>}
        </div>
      )}
      {metadataFieldDefs.length > 0 && (
        <div className="lh-page-card">
          <FormRenderer
            fieldDefs={metadataFieldDefs}
            value={payload}
            onChange={onChange}
            errors={errors}
            widgets={{
              ...mediaWidgets(publicBucketUrl),
              ...tagsWidget(),
              ...referenceWidget(),
              filter_tags: FilterTagsWidget,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default class SchemaItemEditor extends React.Component {
  constructor(props) {
    super(props);

    this.onSave = this.onSave.bind(this);
    this.toggleMetadataRail = this.toggleMetadataRail.bind(this);

    const { contentType, item } = props;
    const typeDef = getType(contentType);
    const slugEditable = typeDef.slugEditable !== false;
    this.state = {
      payload: {
        ...seedPayload(contentType, item),
        ...(slugEditable && item && item.slug ? { slug: item.slug } : {}),
      },
      errors: [],
      submitStatus: null,
      topLevelError: null,
      metadataRailOpen: !isMobileViewport(),
    };
  }

  onSave(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    const { contentType, item } = this.props;
    const { payload } = this.state;
    const isEdit = !!item;

    this.setState({ submitStatus: SUBMIT_STATUS__START, errors: [], topLevelError: null });

    const request = isEdit
      ? Requests.axiosPut(`/admin/ajax/items/${item.id}`, payload)
      : Requests.axiosPost("/admin/ajax/items", { content_type: contentType, ...payload });

    request
      .then(() => {
        showToast(isEdit ? "Updated!" : "Created!", "success");
        this.setState({ submitStatus: null }, () => {
          setTimeout(() => {
            if (process.env.NODE_ENV !== "test") {
              window.location.href = ADMIN_URLS.allItems();
            }
          }, 800);
        });
      })
      .catch((error) => {
        const response = error && error.response;
        if (response && response.status === 400 && response.data && response.data.errors) {
          this.setState({ submitStatus: null, errors: response.data.errors });
        } else {
          this.setState({
            submitStatus: null,
            topLevelError: "Failed. Please try again.",
          });
          showToast("Failed. Please try again.", "error");
        }
      });
  }

  toggleMetadataRail() {
    this.setState((prevState) => ({ metadataRailOpen: !prevState.metadataRailOpen }));
  }

  render() {
    const { contentType, item, publicBucketUrl } = this.props;
    const { payload, errors, submitStatus, topLevelError, metadataRailOpen } = this.state;
    const isEdit = !!item;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const fieldDefs = getFieldDefs(contentType);
    const {primaryFieldDefs, metadataFieldDefs} = splitFieldDefs(fieldDefs);
    const isLandingPage = contentType === "landing_page";
    const slugEditable = getType(contentType).slugEditable !== false;
    const mobile = isMobileViewport();
    const metadataPanel = (
      <MetadataPanel
        payload={payload}
        errors={errors}
        metadataFieldDefs={metadataFieldDefs}
        publicBucketUrl={publicBucketUrl}
        showSlug={slugEditable}
        onChange={(nextPayload) => this.setState({ payload: nextPayload })}
      />
    );

    return (
      <form className="flex flex-col gap-4" onSubmit={this.onSave}>
        <header aria-label="Editor header" className="sticky top-0 z-20 bg-bgsecondary-color/95 backdrop-blur border-b border-bdgray-color px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-500">Editor</div>
              {topLevelError && (
                <div className="text-sm text-red-500 mt-1">{topLevelError}</div>
              )}
            </div>
            <button
              type="button"
              className="lh-btn lh-btn-secondary lh-btn-sm"
              onClick={this.toggleMetadataRail}
            >
              {metadataRailOpen ? "Collapse metadata" : "Expand metadata"}
            </button>
            <button
              type="submit"
              className="lh-btn lh-btn-brand-dark lh-btn-lg"
              onClick={this.onSave}
              disabled={submitting}
            >
              {submitting ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <main className="min-w-0 grid grid-cols-1 gap-4">
            <div className="lh-page-card">
              <FormRenderer
                fieldDefs={primaryFieldDefs}
                value={payload}
                onChange={(nextPayload) => this.setState({ payload: nextPayload })}
                errors={errors}
                widgets={{
                  ...mediaWidgets(publicBucketUrl),
                  ...tagsWidget(),
                  ...referenceWidget(),
                  filter_tags: FilterTagsWidget,
                }}
              />
            </div>
            {isLandingPage && <LandingPreview payload={payload} />}
          </main>
          {mobile ? (
            <>
              {metadataRailOpen && (
                <AdminDialog
                  title="Metadata"
                  isOpen={metadataRailOpen}
                  setIsOpen={(next) => {
                    if (!next) {
                      this.toggleMetadataRail();
                    }
                  }}
                  widthClass="w-full sm:max-w-xl"
                >
                  {metadataPanel}
                </AdminDialog>
              )}
            </>
          ) : (
            metadataRailOpen && (
              <aside aria-label="Metadata rail" className="lg:sticky lg:top-24 grid grid-cols-1 gap-4 self-start">
                {metadataPanel}
              </aside>
            )
          )}
        </div>
      </form>
    );
  }
}
