import { Extension, Mark, mergeAttributes } from "@tiptap/core";

export const HighlightExtension = Mark.create({
  name: "highlight",

  parseHTML() {
    return [{ tag: "mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

export const TextAlignExtension = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      types: ["heading", "paragraph"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) => {
              if (!attributes.textAlign) {
                return {};
              }
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const setAlignment = (alignment) => ({ commands }) => {
      let didUpdate = false;
      this.options.types.forEach((type) => {
        didUpdate = commands.updateAttributes(type, { textAlign: alignment }) || didUpdate;
      });
      return didUpdate;
    };

    const clearAlignment = () => ({ commands }) => {
      let didUpdate = false;
      this.options.types.forEach((type) => {
        didUpdate = commands.updateAttributes(type, { textAlign: null }) || didUpdate;
      });
      return didUpdate;
    };

    return {
      setTextAlign: setAlignment,
      unsetTextAlign: clearAlignment,
    };
  },
});
