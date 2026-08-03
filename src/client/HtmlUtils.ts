const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const RAW_TEXT_TAGS = new Set(["pre", "script", "style", "textarea"]);

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

interface TagInfo {
  block: boolean;
  closing: boolean;
  name: string;
  raw: boolean;
  selfClosing: boolean;
}

function getTagInfo(token: string): TagInfo | null {
  if (token.startsWith("<!--") || token.startsWith("<!") || token.startsWith("<?")) {
    return null;
  }

  const match = /^<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)/u.exec(token);
  if (!match) {
    return null;
  }

  const matchedName = match[2];
  if (!matchedName) {
    return null;
  }
  const name = matchedName.toLowerCase();
  return {
    block: BLOCK_TAGS.has(name),
    closing: match[1] === "/",
    name,
    raw: RAW_TEXT_TAGS.has(name),
    selfClosing: VOID_TAGS.has(name) || /\/\s*>$/u.test(token),
  };
}

function findTagEnd(source: string, start: number): number {
  let quote = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        quote = "";
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function tokenizeHtml(source: string): string[] {
  const tokens: string[] = [];
  let textStart = 0;
  let index = 0;

  while (index < source.length) {
    if (source[index] !== "<") {
      index += 1;
      continue;
    }

    if (index > textStart) {
      tokens.push(source.slice(textStart, index));
    }

    let tagEnd: number;
    if (source.startsWith("<!--", index)) {
      const commentEnd = source.indexOf("-->", index + 4);
      tagEnd = commentEnd === -1 ? source.length - 1 : commentEnd + 2;
    } else {
      tagEnd = findTagEnd(source, index);
      if (tagEnd === -1) {
        tokens.push(source.slice(index));
        return tokens;
      }
    }

    const token = source.slice(index, tagEnd + 1);
    tokens.push(token);
    index = tagEnd + 1;
    textStart = index;

    const tag = getTagInfo(token);
    if (tag?.raw && !tag.closing && !tag.selfClosing) {
      const closingStart = source.toLowerCase().indexOf(`</${tag.name}`, index);
      if (closingStart !== -1) {
        if (closingStart > index) {
          tokens.push(source.slice(index, closingStart));
        }
        const closingEnd = findTagEnd(source, closingStart);
        if (closingEnd === -1) {
          tokens.push(source.slice(closingStart));
          return tokens;
        }
        tokens.push(source.slice(closingStart, closingEnd + 1));
        index = closingEnd + 1;
        textStart = index;
      }
    }
  }

  if (textStart < source.length) {
    tokens.push(source.slice(textStart));
  }
  return tokens;
}

interface OpenBlock {
  multiline: boolean;
  name: string;
  raw: boolean;
}

/**
 * Formats rich-text HTML for its initial source-editor presentation.
 * This deliberately runs at editor mount time only; it is not a save-time
 * canonicalizer and must not rewrite text while somebody is typing.
 */
export function formatHtmlForEditing(value: string): string {
  const source = value.trim();
  if (!source) {
    return "";
  }

  const lines: string[] = [];
  const openBlocks: OpenBlock[] = [];
  let currentLine = "";
  let indentation = 0;

  const write = (text: string) => {
    if (!currentLine) {
      currentLine = `${"  ".repeat(indentation)}${text}`;
    } else {
      currentLine += text;
    }
  };

  const flush = () => {
    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }
    currentLine = "";
  };

  const tokens = tokenizeHtml(source);
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex] ?? "";
    const tag = token.startsWith("<") ? getTagInfo(token) : null;
    const currentBlock = openBlocks.at(-1);

    if (!tag) {
      if (token.startsWith("<")) {
        if (currentLine && !currentLine.trim()) {
          currentLine = "";
        }
        write(token);
      } else if (currentBlock?.raw) {
        write(token);
      } else {
        const previousToken = tokens[tokenIndex - 1];
        const nextToken = tokens[tokenIndex + 1];
        const adjacentToBlock = [previousToken, nextToken].some((candidate) => (
          candidate?.startsWith("<") && getTagInfo(candidate)?.block
        ));
        if (token.trim() || (!adjacentToBlock && currentLine)) {
          write(token);
        }
      }
      continue;
    }

    if (tag.block && tag.closing) {
      const opening = openBlocks.at(-1);
      if (!opening || opening.name !== tag.name) {
        write(token);
        continue;
      }

      indentation = Math.max(0, indentation - 1);
      openBlocks.pop();
      if (opening.multiline) {
        flush();
        write(token);
      } else {
        write(token);
      }
      flush();
      continue;
    }

    if (tag.block) {
      if (currentLine && !currentLine.trim()) {
        currentLine = "";
      }
      if (currentLine) {
        flush();
      }
      const parent = openBlocks.at(-1);
      if (parent) {
        parent.multiline = true;
      }
      write(token);
      if (tag.selfClosing) {
        flush();
      } else {
        openBlocks.push({multiline: false, name: tag.name, raw: tag.raw});
        indentation += 1;
      }
      continue;
    }

    write(token);
  }

  flush();
  return lines.join("\n");
}
