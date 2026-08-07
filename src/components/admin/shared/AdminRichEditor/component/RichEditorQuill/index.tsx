import React from "react";
import Quill, {Delta, type EmitterSource} from "quill";
import {
  serializeRichEditorHtml,
  shouldReplaceRichEditorHtml,
} from "@/client/RichEditorHtml";
import {labelRichEditorToolbar} from "@/client/RichEditorToolbar";
import {
  applyRichEditorMediaSettings,
  findRichEditorMediaElement,
  isValidMediaDimension,
  readRichEditorMediaSettings,
  RICH_EDITOR_LEGACY_VIDEO_FORMAT,
  RICH_EDITOR_MEDIA_STYLE_FORMAT,
  RICH_EDITOR_MEDIA_TITLE_FORMAT,
  richEditorMediaType,
  type RichEditorMediaSettings,
  type RichEditorMediaType,
} from "@/client/RichEditorMedia";
import RichEditorMediaDialog from "../RichEditorMediaDialog";
import RichEditorMediaSettingsDialog from "../RichEditorMediaSettingsDialog";

const BaseImage = Quill.import("formats/image") as any;
const BaseVideo = Quill.import("formats/video") as any;

function mediaStyleBlot(BaseBlot: any) {
  return class extends BaseBlot {
    static formats(domNode: HTMLElement) {
      const formats = super.formats(domNode);
      const style = domNode.getAttribute("style");
      const title = domNode.getAttribute("title");
      return {
        ...formats,
        ...(style && {[RICH_EDITOR_MEDIA_STYLE_FORMAT]: style}),
        ...(title && {[RICH_EDITOR_MEDIA_TITLE_FORMAT]: title}),
      };
    }

    format(name: string, value: unknown) {
      if (name === RICH_EDITOR_MEDIA_STYLE_FORMAT) {
        if (value) {
          this.domNode.setAttribute("style", String(value));
        } else {
          this.domNode.removeAttribute("style");
        }
        return;
      }
      if (name === RICH_EDITOR_MEDIA_TITLE_FORMAT) {
        if (value) {
          this.domNode.setAttribute("title", String(value));
        } else {
          this.domNode.removeAttribute("title");
        }
        return;
      }
      super.format(name, value);
    }
  };
}

class NativeVideo extends BaseVideo {
  static blotName = "video";
  static className = "";
  static tagName = "VIDEO";

  static create(value: string) {
    const node = super.create(value) as HTMLVideoElement;
    node.removeAttribute("allowfullscreen");
    node.removeAttribute("frameborder");
    node.setAttribute("controls", "");
    node.setAttribute("playsinline", "");
    node.setAttribute("preload", "metadata");
    node.setAttribute("width", "100%");
    node.style.height = "auto";
    return node;
  }

  html() {
    return this.domNode.outerHTML;
  }
}

const StyledLegacyVideo = mediaStyleBlot(BaseVideo);
StyledLegacyVideo.blotName = RICH_EDITOR_LEGACY_VIDEO_FORMAT;

Quill.register({
  "formats/image": mediaStyleBlot(BaseImage),
  [`formats/${RICH_EDITOR_LEGACY_VIDEO_FORMAT}`]: StyledLegacyVideo,
  "formats/video": mediaStyleBlot(NativeVideo),
}, true);

const toolbarIcons = Quill.import("ui/icons") as Record<string, string>;
toolbarIcons["code-block"] = [
  '<svg viewbox="0 0 18 18">',
  '<rect class="ql-stroke" height="12" width="14" x="2" y="3"/>',
  '<polyline class="ql-even ql-stroke" points="6 7 4 9 6 11"/>',
  '<polyline class="ql-even ql-stroke" points="12 7 14 9 12 11"/>',
  '<line class="ql-stroke" x1="10" x2="8" y1="5" y2="13"/>',
  '</svg>',
].join("");

interface ScrollPosition {
  element: Element;
  scrollLeft: number;
  scrollTop: number;
}

function preserveScrollPositions(editorRoot: HTMLElement): () => void {
  const elements = new Set<Element>();
  let current: HTMLElement | null = editorRoot;
  while (current) {
    elements.add(current);
    current = current.parentElement;
  }
  if (editorRoot.ownerDocument.scrollingElement) {
    elements.add(editorRoot.ownerDocument.scrollingElement);
  }

  const positions: ScrollPosition[] = Array.from(elements).map((element) => ({
    element,
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
  }));
  return () => positions.forEach(({element, scrollLeft, scrollTop}) => {
    element.scrollLeft = scrollLeft;
    element.scrollTop = scrollTop;
  });
}

const toolbarOptions = [
  [{'header': [2, 3, false]}],
  ['bold', 'italic', 'underline', 'blockquote', 'code', 'code-block'],
  [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
  ['link', 'image', 'video'],
  ['clean']
];

const modules = {
  toolbar: {
    container: toolbarOptions,
    // handlers: {
    //   image: imageHandler,
    //   video: videoHandler,
    // },
  },
  keyboard: {
    bindings: {
      preserveScrollOnEnter: {
        key: "Enter",
        handler(this: {quill: Quill}) {
          const quill = this.quill;
          const editorRoot = quill.root;
          const selection = quill.getSelection();
          const [currentLine] = selection
            ? quill.getLine(selection.index)
            : [null, -1];
          const lines = quill.getLines();
          const shouldRevealNewLine = Boolean(
            currentLine && currentLine === lines[lines.length - 1],
          );
          const restoreScrollPositions = preserveScrollPositions(editorRoot);
          editorRoot.ownerDocument.defaultView?.requestAnimationFrame(() => {
            if (editorRoot.isConnected) {
              restoreScrollPositions();
              if (shouldRevealNewLine) {
                quill.scrollSelectionIntoView();
              }
            }
          });
          return true;
        },
      },
      exitTerminalCodeBlock: {
        key: "Enter",
        collapsed: true,
        format: ["code-block"],
        prefix: /^$/,
        suffix: /^\s*$/,
        handler(this: {quill: Quill}, range: {index: number}) {
          const [line] = this.quill.getLine(range.index) as [
            {next?: {formats?: () => Record<string, unknown>}} | null,
            number,
          ];
          if (line?.next?.formats?.()["code-block"]) {
            return true;
          }

          this.quill.formatLine(
            range.index,
            1,
            "code-block",
            false,
            Quill.sources.USER,
          );
          this.quill.setSelection(range.index, 0, Quill.sources.SILENT);
          return false;
        },
      },
    },
  },
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'blockquote', 'code', 'code-block',
  'list', 'indent',
  'link',
  'image', 'video', RICH_EDITOR_LEGACY_VIDEO_FORMAT,
  RICH_EDITOR_MEDIA_STYLE_FORMAT,
  RICH_EDITOR_MEDIA_TITLE_FORMAT,
];

const EMPTY_MEDIA_SETTINGS: RichEditorMediaSettings = {
  alt: "",
  height: "",
  style: "",
  title: "",
  width: "",
};

type MediaDropPosition = "after" | "before";

function editorBlockForTarget(
  target: EventTarget | null,
  editorRoot: HTMLElement,
): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target === editorRoot) {
    return editorRoot.lastElementChild as HTMLElement | null;
  }

  let block: HTMLElement | null = target;
  while (block?.parentElement && block.parentElement !== editorRoot) {
    block = block.parentElement;
  }
  return block?.parentElement === editorRoot ? block : null;
}

function blockEndsWithMedia(block: HTMLElement): boolean {
  if (block.matches("img, video, iframe.ql-video")) {
    return true;
  }
  return Boolean(
    block.querySelector("img, video, iframe.ql-video") &&
    !block.textContent?.trim(),
  );
}

export default class RichEditorQuill extends React.Component<any, any> {
  editorElement: HTMLDivElement | null = null;
  quillRef: Quill | null = null;
  textChangeHandler:
    | ((delta: Delta, oldDelta: Delta, source: EmitterSource) => void)
    | null = null;
  mediaClickHandler: ((event: MouseEvent) => void) | null = null;
  mediaDragEndHandler: ((event: DragEvent) => void) | null = null;
  mediaDragOverHandler: ((event: DragEvent) => void) | null = null;
  mediaDragStartHandler: ((event: DragEvent) => void) | null = null;
  mediaDropHandler: ((event: DragEvent) => void) | null = null;
  draggedMediaElement: HTMLElement | null = null;
  mediaDropBlock: HTMLElement | null = null;
  mediaDropPosition: MediaDropPosition | null = null;
  selectedMediaElement: HTMLElement | null = null;
  lastMediaClickAt = 0;
  lastMediaClickElement: HTMLElement | null = null;
  lastEmittedHtml: string | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      isInsertOpen: false,
      mediaType: 'image',
      quillSelection: null,
      isSettingsOpen: false,
      mediaSettings: EMPTY_MEDIA_SETTINGS,
      mediaSettingsErrors: {},
      settingsMediaElement: null,
      settingsMediaType: 'image',
    };
    this.saveMediaSettings = this.saveMediaSettings.bind(this);
  }

  serializedHtml() {
    return this.quillRef ? serializeRichEditorHtml(this.quillRef.root) : "";
  }

  emitHtmlChange() {
    const html = this.serializedHtml();
    this.lastEmittedHtml = html;
    this.props.onChange(html);
  }

  enableMediaDragging() {
    this.quillRef?.root.querySelectorAll<HTMLElement>(
      "img, video, iframe.ql-video",
    ).forEach((element) => {
      element.draggable = true;
    });
  }

  ensureTrailingEditableLine() {
    const editor = this.quillRef;
    const lastBlock = editor?.root.lastElementChild as HTMLElement | null;
    if (!editor || !lastBlock || !blockEndsWithMedia(lastBlock)) {
      return;
    }

    const lastBlot = Quill.find(lastBlock) as any;
    const parentBlot = lastBlot?.parent;
    if (!lastBlot || !parentBlot) {
      return;
    }
    const editableBlock = editor.scroll.create("block");
    parentBlot.insertBefore(editableBlock, lastBlot.next);
    editor.update(Quill.sources.USER);
  }

  clearMediaDragState() {
    this.draggedMediaElement?.classList.remove("rich-editor-media-dragging");
    this.mediaDropBlock?.classList.remove(
      "rich-editor-media-drop-after",
      "rich-editor-media-drop-before",
    );
    this.draggedMediaElement = null;
    this.mediaDropBlock = null;
    this.mediaDropPosition = null;
  }

  selectMediaForClipboard(element: HTMLElement) {
    const editor = this.quillRef;
    const mediaBlot = Quill.find(element) as any;
    if (!editor || !mediaBlot) {
      return;
    }
    this.selectedMediaElement?.classList.remove("rich-editor-media-selected");
    this.selectedMediaElement = element;
    element.classList.add("rich-editor-media-selected");
    editor.setSelection(
      editor.getIndex(mediaBlot),
      mediaBlot.length(),
      Quill.sources.USER,
    );
  }

  clearSelectedMedia() {
    this.selectedMediaElement?.classList.remove("rich-editor-media-selected");
    this.selectedMediaElement = null;
  }

  showMediaDropPosition(
    block: HTMLElement,
    position: MediaDropPosition,
  ) {
    if (this.mediaDropBlock === block && this.mediaDropPosition === position) {
      return;
    }
    this.mediaDropBlock?.classList.remove(
      "rich-editor-media-drop-after",
      "rich-editor-media-drop-before",
    );
    this.mediaDropBlock = block;
    this.mediaDropPosition = position;
    block.classList.add(`rich-editor-media-drop-${position}`);
  }

  moveDraggedMedia() {
    const editor = this.quillRef;
    const sourceElement = this.draggedMediaElement;
    const targetBlock = this.mediaDropBlock;
    const position = this.mediaDropPosition;
    if (!editor || !sourceElement || !targetBlock || !position) {
      return;
    }

    const sourceBlot = Quill.find(sourceElement) as any;
    const targetBlot = Quill.find(targetBlock) as any;
    if (!sourceBlot || !targetBlot) {
      return;
    }
    const sourceIndex = editor.getIndex(sourceBlot);
    const sourceLength = sourceBlot.length();
    const targetStart = editor.getIndex(targetBlot);
    const targetIndex = position === "after"
      ? targetStart + targetBlot.length()
      : targetStart;
    if (
      targetIndex >= sourceIndex &&
      targetIndex <= sourceIndex + sourceLength
    ) {
      return;
    }

    const mediaOperation = editor.getContents(
      sourceIndex,
      sourceLength,
    ).ops.find((operation) => typeof operation.insert === "object");
    if (!mediaOperation || typeof mediaOperation.insert !== "object") {
      return;
    }

    let change = new Delta();
    let nextIndex: number;
    if (sourceIndex < targetIndex) {
      nextIndex = targetIndex - sourceLength;
      change = change
        .retain(sourceIndex)
        .delete(sourceLength)
        .retain(nextIndex - sourceIndex)
        .insert(mediaOperation.insert, mediaOperation.attributes);
    } else {
      nextIndex = targetIndex;
      change = change
        .retain(targetIndex)
        .insert(mediaOperation.insert, mediaOperation.attributes)
        .retain(sourceIndex - targetIndex)
        .delete(sourceLength);
    }
    editor.updateContents(change, Quill.sources.USER);
    this.ensureTrailingEditableLine();
    editor.setSelection(nextIndex + sourceLength, 0, Quill.sources.SILENT);
  }

  openMediaSettings(element: HTMLElement) {
    this.setState({
      isSettingsOpen: true,
      mediaSettings: readRichEditorMediaSettings(element),
      mediaSettingsErrors: {},
      settingsMediaElement: element,
      settingsMediaType: richEditorMediaType(element),
    });
  }

  saveMediaSettings() {
    const {
      mediaSettings,
      settingsMediaElement,
      settingsMediaType,
    } = this.state as {
      mediaSettings: RichEditorMediaSettings;
      settingsMediaElement: HTMLElement | null;
      settingsMediaType: RichEditorMediaType;
    };
    const errors = {
      ...(!isValidMediaDimension(mediaSettings.width, "width") && {
        width: "Enter a valid CSS width, such as 100%, 640px, or auto.",
      }),
      ...(!isValidMediaDimension(mediaSettings.height, "height") && {
        height: "Enter a valid CSS height, such as auto or 360px.",
      }),
    };
    if (Object.keys(errors).length > 0) {
      this.setState({mediaSettingsErrors: errors});
      return;
    }
    if (!settingsMediaElement || !this.quillRef) {
      this.setState({isSettingsOpen: false});
      return;
    }

    applyRichEditorMediaSettings(
      settingsMediaElement,
      settingsMediaType,
      mediaSettings,
    );
    this.quillRef.update(Quill.sources.USER);
    this.emitHtmlChange();
    this.setState({
      isSettingsOpen: false,
      mediaSettingsErrors: {},
      settingsMediaElement: null,
    });
  }

  componentDidMount() {
    if (!this.editorElement) {
      return;
    }
    const editor = new Quill(this.editorElement, {
      formats,
      modules,
      theme: 'snow',
    });
    this.quillRef = editor;
    const initialValue = this.props.value || '';
    if (initialValue) {
      editor.clipboard.dangerouslyPasteHTML(initialValue, 'silent');
    }
    this.textChangeHandler = (_delta, _oldDelta, source) => {
      this.enableMediaDragging();
      if (source !== 'silent') {
        this.emitHtmlChange();
      }
    };
    editor.on('text-change', this.textChangeHandler);

    const toolbar = editor.getModule('toolbar') as {
      addHandler: (format: string, handler: () => void) => void;
      container: HTMLElement;
    };
    labelRichEditorToolbar(toolbar.container);
    toolbar.addHandler('image', () => {
      this.setState({
        isInsertOpen: true,
        mediaType: 'image',
        quillSelection: editor.getSelection(),
      });
    });
    toolbar.addHandler('video', () => {
      this.setState({
        isInsertOpen: true,
        mediaType: 'video',
        quillSelection: editor.getSelection(),
      });
    });
    this.mediaClickHandler = (event) => {
      const mediaElement = findRichEditorMediaElement(
        event.target,
        editor.root,
      );
      const target = event.target instanceof Element ? event.target : null;
      if (!mediaElement) {
        if (target && editor.root.contains(target)) {
          this.clearSelectedMedia();
        }
        this.lastMediaClickAt = 0;
        this.lastMediaClickElement = null;
        return;
      }

      this.selectMediaForClipboard(mediaElement);

      const clickedAt = Date.now();
      const isDoubleClick =
        mediaElement === this.lastMediaClickElement &&
        clickedAt - this.lastMediaClickAt <= 650;
      this.lastMediaClickAt = clickedAt;
      this.lastMediaClickElement = mediaElement;
      if (!isDoubleClick) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.lastMediaClickAt = 0;
      this.lastMediaClickElement = null;
      this.openMediaSettings(mediaElement);
    };
    document.addEventListener(
      "click",
      this.mediaClickHandler,
      true,
    );
    this.mediaDragStartHandler = (event) => {
      const mediaElement = findRichEditorMediaElement(event.target, editor.root);
      if (!mediaElement) {
        return;
      }
      this.draggedMediaElement = mediaElement;
      mediaElement.classList.add("rich-editor-media-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "microfeed-rich-editor-media");
      }
    };
    this.mediaDragOverHandler = (event) => {
      if (!this.draggedMediaElement) {
        return;
      }
      const block = editorBlockForTarget(event.target, editor.root);
      if (!block || block.contains(this.draggedMediaElement)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const bounds = block.getBoundingClientRect();
      this.showMediaDropPosition(
        block,
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
      );
    };
    this.mediaDropHandler = (event) => {
      if (!this.draggedMediaElement || !this.mediaDropBlock) {
        return;
      }
      event.preventDefault();
      this.moveDraggedMedia();
      this.clearMediaDragState();
    };
    this.mediaDragEndHandler = () => this.clearMediaDragState();
    editor.root.addEventListener("dragstart", this.mediaDragStartHandler);
    editor.root.addEventListener("dragover", this.mediaDragOverHandler);
    editor.root.addEventListener("drop", this.mediaDropHandler);
    editor.root.addEventListener("dragend", this.mediaDragEndHandler);
    this.enableMediaDragging();
    this.ensureTrailingEditableLine();
  }

  componentDidUpdate(previousProps: any) {
    if (
      this.quillRef &&
      previousProps.value !== this.props.value
    ) {
      const nextValue = this.props.value || '';
      const currentValue = this.serializedHtml();
      const shouldReplace = shouldReplaceRichEditorHtml(
        nextValue,
        currentValue,
        this.lastEmittedHtml,
      );
      this.lastEmittedHtml = null;
      if (shouldReplace) {
        const selection = this.quillRef.getSelection();
        this.quillRef.clipboard.dangerouslyPasteHTML(nextValue, 'silent');
        this.enableMediaDragging();
        this.ensureTrailingEditableLine();
        if (selection) {
          const maxIndex = Math.max(0, this.quillRef.getLength() - 1);
          this.quillRef.setSelection(
            Math.min(selection.index, maxIndex),
            Math.min(selection.length, maxIndex),
            'silent',
          );
        }
      }
    }
  }

  componentWillUnmount() {
    if (this.quillRef) {
      const root = this.quillRef.root;
      if (this.mediaDragStartHandler) {
        root.removeEventListener("dragstart", this.mediaDragStartHandler);
      }
      if (this.mediaDragOverHandler) {
        root.removeEventListener("dragover", this.mediaDragOverHandler);
      }
      if (this.mediaDropHandler) {
        root.removeEventListener("drop", this.mediaDropHandler);
      }
      if (this.mediaDragEndHandler) {
        root.removeEventListener("dragend", this.mediaDragEndHandler);
      }
    }
    if (this.quillRef && this.mediaClickHandler) {
      document.removeEventListener(
        "click",
        this.mediaClickHandler,
        true,
      );
    }
    if (this.quillRef && this.textChangeHandler) {
      this.quillRef.off('text-change', this.textChangeHandler);
    }
    this.clearMediaDragState();
    this.clearSelectedMedia();
    this.mediaDragEndHandler = null;
    this.mediaDragOverHandler = null;
    this.mediaDragStartHandler = null;
    this.mediaDropHandler = null;
    this.mediaClickHandler = null;
    this.lastMediaClickAt = 0;
    this.lastMediaClickElement = null;
    this.lastEmittedHtml = null;
    this.textChangeHandler = null;
    this.quillRef = null;
  }

  render() {
    const {extra} = this.props;
    const {
      isInsertOpen,
      isSettingsOpen,
      mediaSettings,
      mediaSettingsErrors,
      mediaType,
      quillSelection,
      settingsMediaType,
    } = this.state;
    return <div>
    <div ref={(element) => {
      this.editorElement = element;
    }} />
    <RichEditorMediaDialog
      isOpen={isInsertOpen}
      setIsOpen={(isInsertOpen: any) => this.setState({isInsertOpen})}
      mediaType={mediaType}
      quill={this.quillRef}
      quillSelection={quillSelection}
      extra={extra}
    />
    <p className="mt-2 text-xs text-muted-foreground">
      Tip: Drag an image or video to move it. Double-click to edit its size and
      style.
    </p>
    <RichEditorMediaSettingsDialog
      errors={mediaSettingsErrors}
      mediaType={settingsMediaType}
      onChange={(mediaSettings) => this.setState({
        mediaSettings,
        mediaSettingsErrors: {},
      })}
      onOpenChange={(isSettingsOpen) => this.setState({
        isSettingsOpen,
        ...(!isSettingsOpen && {settingsMediaElement: null}),
      })}
      onSave={this.saveMediaSettings}
      open={isSettingsOpen}
      settings={mediaSettings}
    />
  </div>
  }
}
