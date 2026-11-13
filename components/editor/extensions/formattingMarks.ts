import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImage } from "../ResizableImage";
import { lowlight } from "../lowlight";
import { CodeBlockComponent } from "../CodeBlockComponent";

/**
 * Custom CodeBlock extension with Lowlight syntax highlighting and copy functionality.
 */
export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
}).configure({
  lowlight,
});

/**
 * Custom TipTap TaskList extension supporting ChatGPT/GFM checklist markup.
 */
export const CustomTaskList = TaskList.extend({
  parseHTML() {
    return [
      {
        tag: `ul[data-type="${this.name}"]`,
        priority: 70,
      },
      {
        tag: "ul.contains-task-list",
        priority: 70,
      },
      {
        tag: "ul",
        getAttrs: (element) => {
          if (
            element instanceof HTMLElement &&
            (element.classList.contains("contains-task-list") ||
              element.querySelector("li.task-list-item, input[type='checkbox']"))
          ) {
            return {};
          }
          return false;
        },
        priority: 65,
      },
    ];
  },
});

/**
 * Custom TipTap TaskItem extension extracting checkbox state across pasted HTML formats.
 */
export const CustomTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => {
          const dataChecked = element.getAttribute("data-checked");
          if (dataChecked === "" || dataChecked === "true") return true;
          const checkbox = element.querySelector(
            "input[type='checkbox']",
          ) as HTMLInputElement | null;
          if (checkbox) {
            return checkbox.checked || checkbox.hasAttribute("checked");
          }
          return false;
        },
        renderHTML: (attributes) => ({
          "data-checked": attributes.checked,
        }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 70,
        contentElement: (element) => element.querySelector("div") ?? element,
      },
      {
        tag: "li.task-list-item",
        priority: 70,
        contentElement: (element) => element.querySelector("div") ?? element,
      },
      {
        tag: "li",
        getAttrs: (element) => {
          if (
            element instanceof HTMLElement &&
            (element.classList.contains("task-list-item") ||
              element.querySelector("input[type='checkbox']"))
          ) {
            return {};
          }
          return false;
        },
        priority: 65,
        contentElement: (element) => element.querySelector("div") ?? element,
      },
    ];
  },
});

/**
 * Custom TipTap Image extension with width & alignment serialization to Markdown.
 */
export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute("width") || element.style.width;
          if (!width) return null;
          const parsed = parseInt(width, 10);
          return isNaN(parsed) ? width : parsed;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      textAlign: {
        default: "left",
        parseHTML: (element) =>
          element.getAttribute("data-align") ||
          element.style.textAlign ||
          "left",
        renderHTML: (attributes) => {
          if (!attributes.textAlign || attributes.textAlign === "left") {
            return {};
          }
          return {
            "data-align": attributes.textAlign,
            style: `text-align: ${attributes.textAlign}`,
          };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage);
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const hasCustomAttrs =
            node.attrs.width ||
            (node.attrs.textAlign && node.attrs.textAlign !== "left");
          if (hasCustomAttrs) {
            const widthAttr = node.attrs.width
              ? ` width="${node.attrs.width}"`
              : "";
            const alignAttr =
              node.attrs.textAlign && node.attrs.textAlign !== "left"
                ? ` data-align="${node.attrs.textAlign}"`
                : "";
            const titleAttr = node.attrs.title
              ? ` title="${state.esc(node.attrs.title)}"`
              : "";
            state.write(
              `<img src="${node.attrs.src}" alt="${state.esc(
                node.attrs.alt || "",
              )}"${widthAttr}${alignAttr}${titleAttr} />`,
            );
          } else {
            state.write(
              `![${state.esc(node.attrs.alt || "")}](${node.attrs.src}${
                node.attrs.title ? ` "${state.esc(node.attrs.title)}"` : ""
              })`,
            );
          }
        },
        parse: {},
      },
    };
  },
});

export const CustomUnderline = Underline.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "<u>",
          close: "</u>",
        },
      },
    };
  },
});

export const CustomHighlight = Highlight.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "==",
          close: "==",
        },
      },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * Custom TipTap FontSize mark extension with HTML span style serialization.
 */
export const CustomFontSize = Mark.create({
  name: "fontSize",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) =>
          element.style.fontSize ||
          element.getAttribute("data-font-size") ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.size) return {};
          return {
            style: `font-size: ${attributes.size}`,
            "data-font-size": attributes.size,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[style*='font-size']" }, { tag: "span[data-font-size]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open(_state: any, mark: any) {
            return `<span style="font-size: ${mark.attrs.size}">`;
          },
          close: "</span>",
        },
        parse: {},
      },
    };
  },
});

/**
 * Keyboard shortcuts for rich formatting actions.
 */
export const CustomShortcuts = Extension.create({
  name: "customShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => this.editor.commands.toggleStrike(),
      "Mod-Shift-S": () => this.editor.commands.toggleStrike(),
      "Mod-Shift-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-L": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-e": () => this.editor.commands.setTextAlign("center"),
      "Mod-Shift-E": () => this.editor.commands.setTextAlign("center"),
      "Mod-Shift-r": () => this.editor.commands.setTextAlign("right"),
      "Mod-Shift-R": () => this.editor.commands.setTextAlign("right"),
      "Mod-Shift-j": () => this.editor.commands.setTextAlign("justify"),
      "Mod-Shift-J": () => this.editor.commands.setTextAlign("justify"),
      "Mod-Shift-9": () => this.editor.commands.toggleTaskList(),
    };
  },
});
