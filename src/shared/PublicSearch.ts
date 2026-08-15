export type PublicSearchResult = Record<string, unknown> & {
  content_text?: string;
  date_published?: string;
  highlights?: {
    content_text?: PublicSearchHighlightSegment[];
    title?: PublicSearchHighlightSegment[];
  };
  id?: string;
  title: string;
  type: "item" | "page";
  url: string;
};

export interface PublicSearchHighlightSegment {
  matched: boolean;
  text: string;
}

export const PUBLIC_SEARCH_PREVIEW_WARNING =
  "Live search is unavailable in preview. Showing preview results instead.";

interface PublicSearchOptions {
  previewResults?: PublicSearchResult[];
}

const PUBLIC_SEARCH_TEMPLATE = `<dialog id="microfeed-search-dialog" class="mf-public-search" data-microfeed-search-dialog data-search-endpoint="/search.json">
  <form action="/search/" method="get" class="mf-public-search__panel">
    <div class="mf-public-search__header">
      <label for="microfeed-search-dialog-input">Search this site</label>
      <button type="button" class="mf-public-search__close" aria-label="Close search" data-microfeed-search-close>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </div>
    {{PREVIEW_NOTICE}}
    <div class="mf-public-search__input-row">
      <input id="microfeed-search-dialog-input" name="q" type="search" placeholder="Search items and pages" autocomplete="off" data-microfeed-search-input data-microfeed-search-preview-initial />
      <button type="submit">
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2" /><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        <span>Search</span>
      </button>
    </div>
    <div class="mf-public-search__results" aria-live="polite" data-microfeed-search-results></div>
    {{PREVIEW_DATA}}
  </form>
</dialog>

<style>
  .mf-public-search {
    position: fixed;
    inset: 0;
    z-index: 1000;
    width: min(44rem, calc(100vw - 2rem));
    max-height: min(38rem, calc(100vh - 2rem));
    padding: 0;
    border: 1px solid var(--mf-border, #d0d7de);
    border-radius: 1rem;
    margin: auto;
    overflow: hidden;
    background: var(--mf-background, Canvas);
    color: var(--mf-text, CanvasText);
    box-shadow: 0 1.5rem 5rem rgb(0 0 0 / 28%);
  }
  .mf-public-search::backdrop {
    background: rgb(15 23 42 / 45%);
    backdrop-filter: blur(4px);
  }
  .mf-public-search__panel {
    box-sizing: border-box;
    display: flex;
    max-height: inherit;
    flex-direction: column;
    padding: 1.25rem;
  }
  .mf-public-search__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .mf-public-search__header label {
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  .mf-public-search__close {
    display: inline-flex;
    width: 2.25rem;
    height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--mf-surface, #f6f8fa);
    color: var(--mf-muted, #57606a);
    transition: background 120ms ease, color 120ms ease, transform 120ms ease;
  }
  .mf-public-search__close:hover {
    background: var(--mf-border, #d0d7de);
    color: var(--mf-text, CanvasText);
  }
  .mf-public-search__close:active { transform: scale(0.94); }
  .mf-public-search-preview-note {
    margin: 0 0 1rem;
    padding: 0.65rem 0.8rem;
    border: 1px solid #d4a72c;
    border-radius: 0.65rem;
    background: #fff8c5;
    color: #633c01;
    font-size: 0.875rem;
  }
  .mf-public-search button { cursor: pointer; }
  .mf-public-search button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--mf-accent, #0969da) 28%, transparent);
    outline-offset: 2px;
  }
  .mf-public-search input[type="search"],
  [data-microfeed-search-input] {
    box-sizing: border-box;
    width: 100%;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--mf-border, #8c959f);
    border-radius: 0.65rem;
    background: var(--mf-background, Canvas);
    color: var(--mf-text, CanvasText);
    font: inherit;
  }
  .mf-public-search input[type="search"]::placeholder {
    color: var(--mf-muted, GrayText);
  }
  .mf-public-search__input-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    border: 1px solid var(--mf-border, #8c959f);
    border-radius: 0.7rem;
    overflow: hidden;
    background: var(--mf-background, Canvas);
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .mf-public-search__input-row:focus-within {
    border-color: var(--mf-accent, #0969da);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mf-accent, #0969da) 20%, transparent);
  }
  .mf-public-search__input-row input[type="search"] {
    min-width: 0;
    border: 0;
    border-radius: 0;
    outline: 0;
  }
  .mf-public-search__input-row button[type="submit"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.75rem 1rem;
    border: 0;
    border-left: 1px solid var(--mf-accent, #0969da);
    border-radius: 0;
    background: var(--mf-accent, #0969da);
    color: #fff;
    font: inherit;
    font-weight: 650;
    transition: filter 120ms ease;
  }
  .mf-public-search__input-row button[type="submit"]:hover { filter: brightness(0.92); }
  .mf-public-search__results {
    display: grid;
    gap: 0.3rem;
    overflow: auto;
    margin-top: 1rem;
  }
  .mf-public-search-result {
    display: block;
    padding: 0.7rem 0.8rem;
    border: 1px solid transparent;
    border-radius: 0.65rem;
    color: var(--mf-accent, #0969da);
    text-decoration: none;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .mf-public-search-result:visited {
    color: var(--mf-accent, #0969da);
  }
  .mf-public-search-result:hover,
  .mf-public-search-result:focus-visible {
    border-color: var(--mf-border, #d0d7de);
    background: var(--mf-surface, #f6f8fa);
    outline: 0;
  }
  .mf-public-search-result__type {
    margin-left: 0.45rem;
    color: var(--mf-muted, GrayText);
    font-size: 0.8em;
    text-transform: capitalize;
  }
  .mf-public-search-message {
    margin: 0;
    padding: 0.75rem 0.8rem;
    color: var(--mf-muted, GrayText);
  }
  @media (max-width: 480px) {
    .mf-public-search {
      width: calc(100vw - 1rem);
      max-height: calc(100vh - 1rem);
      border-radius: 0.8rem;
    }
    .mf-public-search__panel { padding: 1rem; }
    .mf-public-search__input-row button[type="submit"] { padding-inline: 0.85rem; }
    .mf-public-search__input-row button[type="submit"] span { display: none; }
  }
</style>

<script>
  const dialog = document.querySelector("[data-microfeed-search-dialog]");
  const endpoint = dialog?.dataset.searchEndpoint ?? "/search.json";
  const previewData = document.querySelector(
    "[data-microfeed-search-preview-results]",
  );
  let previewResults = null;
  if (previewData) {
    try {
      const parsed = JSON.parse(previewData.textContent ?? "[]");
      previewResults = Array.isArray(parsed) ? parsed : [];
    } catch {
      previewResults = [];
    }
  }
  let controller;
  let lockedScrollPosition;
  let previousScrollStyles;
  let suppressTriggerFocus = false;
  let triggerFocusSuppressionTimer;

  function lockBackgroundScroll(scrollPosition) {
    if (lockedScrollPosition !== undefined) return;
    lockedScrollPosition = scrollPosition;
    previousScrollStyles = {
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      rootOverflow: document.documentElement.style.overflow,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "-" + scrollPosition + "px";
    document.body.style.width = "100%";
  }

  function unlockBackgroundScroll() {
    if (lockedScrollPosition === undefined || !previousScrollStyles) return;
    const scrollPosition = lockedScrollPosition;
    document.documentElement.style.overflow = previousScrollStyles.rootOverflow;
    document.body.style.overflow = previousScrollStyles.bodyOverflow;
    document.body.style.position = previousScrollStyles.bodyPosition;
    document.body.style.top = previousScrollStyles.bodyTop;
    document.body.style.width = previousScrollStyles.bodyWidth;
    lockedScrollPosition = undefined;
    previousScrollStyles = undefined;
    window.scrollTo(0, scrollPosition);
  }

  function suppressTriggerFocusUntilCloseSettles() {
    suppressTriggerFocus = true;
    window.clearTimeout(triggerFocusSuppressionTimer);
    triggerFocusSuppressionTimer = window.setTimeout(() => {
      suppressTriggerFocus = false;
    }, 0);
  }

  function closeSearch() {
    if (!dialog?.open) return;
    suppressTriggerFocusUntilCloseSettles();
    dialog.close();
  }

  function resultContainer(input) {
    const scopes = [
      input.closest("[data-microfeed-search-scope]"),
      input.closest("form"),
      input.closest("section"),
      input.parentElement,
    ];
    for (const scope of scopes) {
      const container = scope?.querySelector(
        "[data-microfeed-search-results]",
      );
      if (container) return container;
    }
    return null;
  }

  function message(container, value) {
    container.replaceChildren();
    const element = document.createElement("p");
    element.className = "mf-public-search-message";
    element.textContent = value;
    container.appendChild(element);
  }

  function formatShortDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function appendExcerpt(element, item) {
    const segments = item.highlights?.content_text;
    const hasMatchedExcerpt = Array.isArray(segments) &&
      segments.some((segment) => segment?.matched && segment.text);
    if (!hasMatchedExcerpt) {
      element.append(document.createTextNode(item.content_text ?? ""));
      return;
    }
    for (const segment of segments) {
      const text = String(segment?.text ?? "");
      if (!text) continue;
      if (!segment?.matched) {
        element.append(document.createTextNode(text));
        continue;
      }
      const mark = document.createElement("mark");
      mark.textContent = text;
      element.appendChild(mark);
    }
  }

  function appendResultDetails(link, item) {
    const publishedDate = formatShortDate(item.date_published);
    const content = String(item.content_text ?? "").trim();
    if (!publishedDate && !content) return;
    const details = document.createElement("p");
    details.className = "mf-public-search-result__details";
    if (publishedDate) {
      const time = document.createElement("time");
      time.dateTime = item.date_published;
      time.textContent = publishedDate;
      details.appendChild(time);
    }
    if (publishedDate && content) {
      details.append(document.createTextNode(" · "));
    }
    if (content) appendExcerpt(details, item);
    link.appendChild(details);
  }

  function showResults(container, items) {
    container.replaceChildren();
    if (items.length === 0) {
      message(container, "No results found.");
      return;
    }
    for (const item of items) {
      const link = document.createElement("a");
      link.className = "mf-public-search-result";
      link.href = item.url;
      const title = document.createElement("strong");
      title.className = "mf-public-search-result__title";
      title.textContent = item.title || "Untitled";
      const type = document.createElement("span");
      type.className = "mf-public-search-result__type";
      type.textContent = item.type;
      link.appendChild(title);
      link.appendChild(type);
      if (container.hasAttribute("data-microfeed-search-details")) {
        appendResultDetails(link, item);
      }
      container.appendChild(link);
    }
  }

  async function search(input) {
    const container = resultContainer(input);
    if (!container) return;
    const query = input.value.trim();
    if (previewResults !== null) {
      if (query.length === 1) {
        message(container, "Type one more character to search.");
        return;
      }
      const normalized = query.toLocaleLowerCase();
      const filtered = normalized
        ? previewResults.filter((item) =>
            [item.title, item.content_text, item.type]
              .some((value) => String(value ?? "")
                .toLocaleLowerCase().includes(normalized))
          )
        : previewResults;
      showResults(container, filtered.slice(0, 12));
      return;
    }
    if (query.length < 2) {
      message(container, query ? "Type one more character to search." : "Start typing to search.");
      return;
    }
    controller?.abort();
    controller = new AbortController();
    message(container, "Searching…");
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("q", query);
      const response = await fetch(url, {
        headers: {accept: "application/json"},
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      showResults(container, data.items ?? []);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") {
        message(container, "Search is temporarily unavailable.");
      }
    }
  }

  for (const input of document.querySelectorAll(
    "[data-microfeed-search-input]",
  )) {
    let timer;
    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void search(input), 150);
    });
    if (
      input.value.trim() ||
      (previewResults !== null && input.hasAttribute(
        "data-microfeed-search-preview-initial",
      ))
    ) void search(input);
  }

  if (previewResults !== null) {
    for (const form of document.querySelectorAll("form")) {
      const input = form.querySelector("[data-microfeed-search-input]");
      if (!input) continue;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void search(input);
      });
    }
  }

  function openSearch() {
    if (!dialog) {
      window.location.assign("/search/");
      return;
    }
    if (!dialog.open) {
      const scrollPosition = window.scrollY;
      dialog.showModal();
      lockBackgroundScroll(scrollPosition);
    }
    dialog.querySelector("[data-microfeed-search-input]")?.focus();
  }

  for (const trigger of document.querySelectorAll(
    "[data-microfeed-search-open]",
  )) {
    trigger.addEventListener("click", openSearch);
    if (trigger instanceof HTMLInputElement) {
      trigger.addEventListener("focus", () => {
        if (suppressTriggerFocus) return;
        openSearch();
      });
    }
    if (!(trigger instanceof HTMLButtonElement)) {
      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openSearch();
      });
    }
  }
  dialog?.querySelector("[data-microfeed-search-close]")
    ?.addEventListener("click", closeSearch);
  dialog?.addEventListener("cancel", suppressTriggerFocusUntilCloseSettles);
  dialog?.addEventListener("close", unlockBackgroundScroll);
  dialog?.querySelector("[data-microfeed-search-input]")
    ?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "Escape" && dialog?.open) {
      event.preventDefault();
      closeSearch();
    }
  });
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeSearch();
  });
</script>`;

function serializedPreviewResults(results: PublicSearchResult[]): string {
  return JSON.stringify(results).replace(/</gu, "\\u003c");
}

export function publicSearchHtml(
  {previewResults}: PublicSearchOptions = {},
): string {
  const preview = previewResults === undefined
    ? {data: "", notice: ""}
    : {
        data: `<script type="application/json" data-microfeed-search-preview-results>${serializedPreviewResults(previewResults)}</script>`,
        notice: `<p class="mf-public-search-preview-note" role="note">${PUBLIC_SEARCH_PREVIEW_WARNING}</p>`,
      };
  return PUBLIC_SEARCH_TEMPLATE
    .replace("{{PREVIEW_NOTICE}}", preview.notice)
    .replace("{{PREVIEW_DATA}}", preview.data);
}
