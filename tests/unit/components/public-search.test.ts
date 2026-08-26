import {runInNewContext} from "node:vm";
import {describe, expect, it} from "vitest";

import {
  PUBLIC_SEARCH_PREVIEW_WARNING,
  publicSearchHtml,
} from "@/shared/PublicSearch";

function inlineFunction(
  source: string,
  name: string,
): (...args: unknown[]) => unknown {
  const start = source.indexOf(`function ${name}(`);
  const braceStart = source.indexOf("{", start);
  if (start < 0 || braceStart < 0) throw new Error(`Missing ${name}.`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth !== 0) continue;
    const functionSource = source.slice(start, index + 1);
    return runInNewContext(`(${functionSource})`, {
      URL,
      window: {location: {origin: "https://feed.example.com"}},
    }) as (...args: unknown[]) => unknown;
  }
  throw new Error(`Unclosed ${name}.`);
}

describe("public search modal", () => {
  it("submits Enter to the full search page", () => {
    const source = publicSearchHtml();

    expect(source).toContain('<form action="/search/" method="get"');
    expect(source).toContain('name="q"');
    expect(source).toContain('<button type="submit">');
    expect(source).toContain("<span>Search</span>");
    expect(source).toContain('event.key !== "Enter" || event.isComposing');
    expect(source).toContain(
      "event.currentTarget.form?.requestSubmit()",
    );
    expect(source).not.toContain('method="dialog"');
  });

  it("closes without submitting the search form", () => {
    const source = publicSearchHtml();

    expect(source).toContain('type="button" class="mf-public-search__close"');
    expect(source).toContain('aria-label="Close search"');
    expect(source).toContain('class="mf-public-search__close"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('[data-microfeed-search-close]');
    expect(source).toContain('addEventListener("click", closeSearch)');
  });

  it("opens from the platform keyboard shortcut", () => {
    const source = publicSearchHtml();

    expect(source).toContain("event.metaKey || event.ctrlKey");
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain("dialog.showModal()");
  });

  it("locks background scrolling while the modal is open", () => {
    const source = publicSearchHtml();

    expect(source).toContain("function lockBackgroundScroll(scrollPosition)");
    expect(source).toContain('document.body.style.position = "fixed"');
    expect(source).toContain(
      'document.body.style.top = "-" + scrollPosition + "px"',
    );
    expect(source).toContain("lockBackgroundScroll(scrollPosition)");
    expect(source).toContain(
      'dialog?.addEventListener("close", unlockBackgroundScroll)',
    );
    expect(source).toContain("window.scrollTo(0, scrollPosition)");
  });

  it("opens from focused, pointer, and keyboard-activated search fields", () => {
    const source = publicSearchHtml();

    expect(source).toContain('id="microfeed-search-dialog"');
    expect(source).toContain('trigger.addEventListener("click", openSearch)');
    expect(source).toContain("trigger instanceof HTMLInputElement");
    expect(source).toContain('trigger.addEventListener("focus", () => {');
    expect(source).toContain("if (suppressTriggerFocus) return");
    expect(source).toContain("trigger instanceof HTMLButtonElement");
    expect(source).toContain('event.key !== "Enter" && event.key !== " "');
  });

  it("does not immediately reopen when dialog focus returns to its trigger", () => {
    const source = publicSearchHtml();

    expect(source).toContain(
      "function suppressTriggerFocusUntilCloseSettles()",
    );
    expect(source).toContain(
      'dialog?.addEventListener("cancel", suppressTriggerFocusUntilCloseSettles)',
    );
    expect(source).toContain("suppressTriggerFocusUntilCloseSettles();");
    expect(source).toContain("dialog.close();");
  });

  it("centers the modal without relying on browser dialog defaults", () => {
    const source = publicSearchHtml();

    expect(source).toMatch(/\.mf-public-search\s*\{[\s\S]*?position: fixed;[\s\S]*?inset: 0;[\s\S]*?margin: auto;/u);
  });

  it("uses a polished attached search control", () => {
    const source = publicSearchHtml();

    expect(source).toContain('placeholder="Search items and pages"');
    expect(source).toMatch(/\.mf-public-search__input-row\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden;/u);
    expect(source).toMatch(/\.mf-public-search__input-row button\[type="submit"\]\s*\{[\s\S]*?background: var\(--mf-accent, #0969da\);/u);
    expect(source).toMatch(/\.mf-public-search__results\s*\{[\s\S]*?margin-top: 1rem;/u);
  });

  it("uses one accent color for visited and unvisited result titles", () => {
    const source = publicSearchHtml();

    expect(source).toMatch(/\.mf-public-search-result\s*\{[\s\S]*?color: var\(--mf-accent, #0969da\);/u);
    expect(source).toMatch(/\.mf-public-search-result:visited\s*\{[\s\S]*?color: var\(--mf-accent, #0969da\);/u);
    expect(source).toContain(
      'title.className = "mf-public-search-result__title"',
    );
  });

  it("adds opt-in destination hostnames and stable row selectors", () => {
    const source = publicSearchHtml();

    expect(source).toContain(
      'data-microfeed-search-results-context="popup"',
    );
    expect(source).toContain(
      'container.setAttribute("data-microfeed-search-results-context", context)',
    );
    expect(source).toContain(
      'link.setAttribute("data-microfeed-search-result-type", resultType)',
    );
    expect(source).toContain(
      'domain.className = "mf-public-search-result__domain"',
    );
    expect(source).toContain("domain.textContent = hostname");
    expect(source).toMatch(
      /\.mf-public-search-result__domain\s*\{[\s\S]*?display: var\(--mf-search-result-domain-display, none\);/u,
    );
  });

  it("derives destination hostnames without changing result URLs", () => {
    const source = publicSearchHtml();
    const resultHostname = inlineFunction(source, "resultHostname");

    expect(resultHostname("https://www.publisher.example/episode"))
      .toBe("www.publisher.example");
    expect(resultHostname("/i/local-result/"))
      .toBe("feed.example.com");
    expect(resultHostname(
      "https://analytics.example/redirect/media/episode.mp3",
    )).toBe("analytics.example");
    expect(resultHostname("http://[invalid"))
      .toBe("");
    expect(resultHostname(""))
      .toBe("");
    expect(source).toContain("link.href = item.url");
  });

  it("renders dated, highlighted excerpts only for detailed result lists", () => {
    const source = publicSearchHtml();

    expect(source).toContain("function formatShortDate(value)");
    expect(source).toContain('new Intl.DateTimeFormat(undefined, {');
    expect(source).toContain("function appendExcerpt(element, item)");
    expect(source).toContain('document.createElement("mark")');
    expect(source).toContain(
      'container.hasAttribute("data-microfeed-search-details")',
    );
    expect(source).toContain(
      'details.className = "mf-public-search-result__details"',
    );
  });

  it("finds results outside a nested search form", () => {
    const source = publicSearchHtml();

    expect(source).toContain('input.closest("form")');
    expect(source).toContain('input.closest("section")');
    expect(source).toContain("for (const scope of scopes)");
    expect(source).toContain("if (container) return container");
  });

  it("uses embedded results and a warning in isolated previews", () => {
    const source = publicSearchHtml({
      previewResults: [{
        content_text: "Representative body",
        date_published: "2026-08-13T10:00:00.000Z",
        highlights: {
          content_text: [
            {matched: false, text: "Representative "},
            {matched: true, text: "body"},
          ],
          title: [],
        },
        id: "preview-item",
        title: "Preview item",
        type: "item",
        url: "https://feed.example.com/i/preview-item/",
      }],
    });

    expect(source).toContain(PUBLIC_SEARCH_PREVIEW_WARNING);
    expect(source).toContain(
      '<script type="application/json" data-microfeed-search-preview-results>',
    );
    expect(source).toContain("data-microfeed-search-preview-initial");
    expect(source).toContain('"title":"Preview item"');
    expect(source).toContain('"date_published":"2026-08-13T10:00:00.000Z"');
    expect(source).toContain('"matched":true');
    expect(source).toContain("if (previewResults !== null)");
    expect(source).toContain("event.preventDefault()");
  });

  it("does not show preview messaging on the live site", () => {
    const source = publicSearchHtml();

    expect(source).not.toContain(PUBLIC_SEARCH_PREVIEW_WARNING);
    expect(source).not.toContain(
      '<script type="application/json" data-microfeed-search-preview-results>',
    );
  });
});
