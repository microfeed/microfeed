import {normalizeCharacterSearch} from "@/shared/CharacterSearch";
import type {SearchHighlightSegment} from "./search";

const segmenter = new Intl.Segmenter("und", {granularity: "grapheme"});

/** Combine FTS word highlights with literal matches, retaining source spelling
 * and whole graphemes even when normalization changes the number of units. */
export function characterHighlights(
  marked: string,
  terms: readonly string[],
  excerpt = false,
): SearchHighlightSegment[] {
  let source = "";
  let wordStart: number | undefined;
  let ranges: Array<[number, number]> = [];
  for (const part of marked.split(/([\u0001\u0002])/u)) {
    if (part === "\u0001") wordStart = source.length;
    else if (part === "\u0002") {
      if (wordStart !== undefined) ranges.push([wordStart, source.length]);
      wordStart = undefined;
    } else source += part;
  }
  let normalized = normalizeCharacterSearch(source);
  let leading = false;
  let trailing = false;
  if (excerpt && source.length > 240) {
    // Locate the first match before allocating grapheme maps. Only the final
    // short excerpt needs those maps, even for megabyte-sized content.
    let first = ranges[0]?.[0] ?? source.length;
    const segments = segmenter.segment(source);
    let literalFirst = normalized.length;
    for (const term of terms) {
      const index = normalized.indexOf(normalizeCharacterSearch(term));
      if (index >= 0) literalFirst = Math.min(literalFirst, index);
    }
    if (literalFirst < normalized.length) {
      const candidate = segments.containing(literalFirst);
      const candidateStart = candidate
        ? normalizeCharacterSearch(source.slice(0, candidate.index)).length : -1;
      if (candidate && candidateStart <= literalFirst &&
        candidateStart + normalizeCharacterSearch(candidate.segment).length > literalFirst) {
        first = Math.min(first, candidate.index);
      } else {
        let low = 0;
        let high = source.length;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (normalizeCharacterSearch(source.slice(0, middle)).length <= literalFirst) low = middle + 1;
          else high = middle;
        }
        first = Math.min(first, Math.max(0, low - 1));
      }
    }
    if (first === source.length) first = 0;
    first = segments.containing(first)?.index ?? first;
    const before = Array.from(source.slice(Math.max(0, first - 120), first)).slice(-60).join("").length;
    let from = first - before;
    from = segments.containing(from)?.index ?? from;
    let to = from + Array.from(source.slice(from, from + 480)).slice(0, 240).join("").length;
    const last = segments.containing(Math.max(from, to - 1));
    if (last) to = last.index + last.segment.length;
    leading = from > 0;
    trailing = to < source.length;
    ranges = ranges.filter(([start, end]) => end > from && start < to)
      .map(([start, end]) => [Math.max(start, from) - from, Math.min(end, to) - from]);
    source = source.slice(from, to);
    normalized = normalizeCharacterSearch(source);
  }
  const starts: number[] = [];
  const ends: number[] = [];
  for (const {segment, index} of segmenter.segment(source)) {
    const length = normalizeCharacterSearch(segment).length;
    for (let offset = 0; offset < length; offset++) {
      starts.push(index);
      ends.push(index + segment.length);
    }
  }
  for (const term of terms) {
    const needle = normalizeCharacterSearch(term);
    for (let index = normalized.indexOf(needle); index >= 0;
      index = normalized.indexOf(needle, index + 1)) {
      ranges.push([starts[index]!, ends[index + needle.length - 1]!]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const from = 0;
  const to = source.length;
  const result: SearchHighlightSegment[] = [];
  if (leading) result.push({matched: false, text: "… "});
  let position = from;
  for (const [start, end] of merged) {
    if (end <= from || start >= to) continue;
    if (start > position) result.push({matched: false, text: source.slice(position, start)});
    result.push({matched: true, text: source.slice(Math.max(start, from), Math.min(end, to))});
    position = Math.min(end, to);
  }
  if (position < to) result.push({matched: false, text: source.slice(position, to)});
  if (trailing) result.push({matched: false, text: " …"});
  return result;
}
