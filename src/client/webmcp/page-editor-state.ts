import type {SavePageDraftInput} from "./schemas";
import type {PageRecord} from "@/shared/Pages";

export type PageEditorDraft = Pick<PageRecord,
  "content_html" | "meta_description" | "navigation_label" |
  "show_in_navigation" | "slug" | "status" | "title"
>;

export function pageWebMcpDraftEligible(options: {
  draftStatus: PageRecord["status"];
  isNotFoundPage: boolean;
  savedStatus?: PageRecord["status"];
}): boolean {
  return !options.isNotFoundPage && options.draftStatus === "unpublished" &&
    (options.savedStatus === undefined || options.savedStatus === "unpublished");
}

export function mergePageWebMcpDraft(
  current: PageEditorDraft,
  input: SavePageDraftInput,
): PageEditorDraft {
  return {...current, ...input, status: "unpublished"};
}
