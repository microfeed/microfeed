import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Underline from "@tiptap/extension-underline";
import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import { BulletList, ListItem, OrderedList, TaskItem, TaskList } from "@tiptap/extension-list";
import RichEditorMediaDialog from "../RichEditorMediaDialog";
import { HighlightExtension, TextAlignExtension } from "./tiptapExtensions";

function ToolbarButton({ label, isActive, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!!isActive}
      className={`lh-btn lh-btn-sm mr-1 mb-1 ${isActive ? "lh-btn-brand-dark" : "lh-btn-secondary"}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children || label}
    </button>
  );
}

export default function RichEditorTiptap({ value, onChange, extra }) {
  const [isMediaOpen, setIsMediaOpen] = React.useState(false);
  const [mediaType, setMediaType] = React.useState("image");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Bold,
      Italic,
      Strike,
      Underline,
      Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      Blockquote,
      CodeBlock,
      HorizontalRule,
      ListItem,
      BulletList,
      OrderedList,
      TaskItem,
      TaskList,
      ImageExtension,
      LinkExtension.configure({ openOnClick: false }),
      HighlightExtension,
      TextAlignExtension.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    onUpdate: ({ editor: updatedEditor }) => {
      if (onChange) {
        onChange(updatedEditor.getHTML());
      }
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (next !== current) {
      editor.commands.setContent(next, false);
    }
  }, [value, editor]);

  React.useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  const insertMedia = (url, insertedMediaType) => {
    if (!editor || !url) {
      return;
    }
    if (insertedMediaType === "image") {
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
        .run();
    }
  };

  if (!editor) {
    return null;
  }

  const headingButtons = [1, 2, 3, 4, 5, 6];
  const alignments = [
    { label: "Align left", value: "left" },
    { label: "Align center", value: "center" },
    { label: "Align right", value: "right" },
    { label: "Justify", value: "justify" },
  ];

  return (
    <div>
      <div className="lh-rich-editor-toolbar flex flex-wrap items-center p-1 border rounded-tl rounded-tr">
        <ToolbarButton
          label="Bold"
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        {headingButtons.map((level) => (
          <ToolbarButton
            key={level}
            label={`H${level}`}
            isActive={editor.isActive("heading", { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </ToolbarButton>
        ))}
        <ToolbarButton
          label="Underline"
          isActive={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          label="Strike"
          isActive={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <ToolbarButton
          label="Blockquote"
          isActive={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          &ldquo;&rdquo;
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          isActive={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {"</>"}
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </ToolbarButton>
        <ToolbarButton
          label="Ordered list"
          isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          label="Task list"
          isActive={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          Task
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          isActive={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          HR
        </ToolbarButton>
        <ToolbarButton
          label="Highlight"
          isActive={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          Mark
        </ToolbarButton>
        {alignments.map((alignment) => (
          <ToolbarButton
            key={alignment.value}
            label={alignment.label}
            isActive={editor.isActive({ textAlign: alignment.value })}
            onClick={() => {
              if (alignment.value === "left") {
                editor.chain().focus().unsetTextAlign().run();
                return;
              }
              editor.chain().focus().setTextAlign(alignment.value).run();
            }}
          >
            {alignment.label}
          </ToolbarButton>
        ))}
        <ToolbarButton
          label="Undo"
          isActive={false}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          isActive={false}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          isActive={editor.isActive("link")}
          onClick={() => {
            setMediaType("link");
            setIsMediaOpen(true);
          }}
        >
          Link
        </ToolbarButton>
        <ToolbarButton
          label="Image"
          isActive={false}
          onClick={() => {
            setMediaType("image");
            setIsMediaOpen(true);
          }}
        >
          Image
        </ToolbarButton>
      </div>
      <div className="border rounded-bl rounded-br">
        <EditorContent className="lh-rich-editor-content px-3 py-2" editor={editor} />
      </div>
      <RichEditorMediaDialog
        isOpen={isMediaOpen}
        setIsOpen={setIsMediaOpen}
        mediaType={mediaType}
        onInsert={insertMedia}
        extra={extra}
      />
    </div>
  );
}
