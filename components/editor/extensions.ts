import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Extension, Node as TiptapNode, Mark, mergeAttributes, InputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as PMNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImage } from "./ResizableImage";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { MathNode, sanitizeLatex } from "./MathNode";
import { lowlight } from "./lowlight";
import { CodeBlockComponent } from "./CodeBlockComponent";
import markdownItFootnote from "markdown-it-footnote";
// @ts-ignore
import markdownItDeflist from "markdown-it-deflist";

export { MathNode, Table, TableRow, TableHeader, TableCell, Superscript };

/**
 * Definition List nodes (<dl>, <dt>, <dd>)
 */
export const DefinitionList = TiptapNode.create({
  name: "definitionList",
  group: "block",
  content: "(definitionTerm | definitionDescription)+",
  parseHTML() {
    return [{ tag: "dl" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "dl",
      mergeAttributes(HTMLAttributes, { class: "theseus-definition-list" }),
      0,
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderContent(node);
          state.write("\n");
        },
      },
    };
  },
});

export const DefinitionTerm = TiptapNode.create({
  name: "definitionTerm",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "dt" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "dt",
      mergeAttributes(HTMLAttributes, { class: "theseus-definition-term" }),
      0,
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderInline(node);
          state.write("\n");
        },
      },
    };
  },
});

export const DefinitionDescription = TiptapNode.create({
  name: "definitionDescription",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [
      {
        tag: "dd",
        contentElement: (element) => element.querySelector("p") ?? element,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "dd",
      mergeAttributes(HTMLAttributes, { class: "theseus-definition-desc" }),
      0,
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(": ");
          state.renderInline(node);
          state.write("\n\n");
        },
      },
    };
  },
});

function markdownItMath(md: any) {
  function mathBlock(state: any, startLine: number, endLine: number, silent: boolean) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (pos >= max) return false;

    const isDollar = state.src.charCodeAt(pos) === 0x24 && state.src.charCodeAt(pos + 1) === 0x24; // $$
    const isBracket = state.src.charCodeAt(pos) === 0x5c && state.src.charCodeAt(pos + 1) === 0x5b; // \[
    if (!isDollar && !isBracket) return false;

    const openMarker = isDollar ? "$$" : "\\[";
    const closeMarker = isDollar ? "$$" : "\\]";

    pos += 2;
    let firstLine = state.src.slice(pos, max);
    if (silent) return true;

    let haveEndMarker = false;
    let nextLine = startLine;

    // Check if closeMarker is on the same line after openMarker
    let sameLineEnd = firstLine.indexOf(closeMarker);
    let lines: string[] = [];

    if (sameLineEnd !== -1) {
      haveEndMarker = true;
      lines.push(firstLine.slice(0, sameLineEnd));
      nextLine = startLine + 1;
    } else {
      lines.push(firstLine);
      for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];
        let lineText = state.src.slice(pos, max);
        let endIdx = lineText.indexOf(closeMarker);
        if (endIdx !== -1) {
          haveEndMarker = true;
          lines.push(lineText.slice(0, endIdx));
          nextLine++;
          break;
        }
        lines.push(lineText);
      }
    }

    if (!haveEndMarker) return false;
    state.line = nextLine;
    const token = state.push("math_block", "div", 0);
    token.block = true;
    token.content = lines.join("\n").trim();
    token.markup = openMarker;
    return true;
  }

  function mathInline(state: any, silent: boolean) {
    let pos = state.pos;
    let max = state.posMax;

    if (pos >= max) return false;

    const isDollar = state.src.charCodeAt(pos) === 0x24; // $
    const isBracket = state.src.charCodeAt(pos) === 0x5c && pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x28; // \(

    if (!isDollar && !isBracket) return false;

    // Check for block delimiter $$ or \[ (let mathBlock handle them)
    if (isDollar && pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x24) {
      return false;
    }

    // Check for escaped \$
    if (isDollar && pos > 0 && state.src.charCodeAt(pos - 1) === 0x5c) {
      return false;
    }

    const openMarker = isDollar ? "$" : "\\(";
    const closeMarker = isDollar ? "$" : "\\)";
    const markerLen = openMarker.length;

    // For dollar sign: ensure next char is not whitespace
    if (isDollar && pos + 1 < max && /\s/.test(state.src[pos + 1])) {
      return false;
    }

    let start = pos + markerLen;
    let match = -1;

    for (let i = start; i < max; i++) {
      if (isDollar) {
        if (state.src.charCodeAt(i) === 0x24 && state.src.charCodeAt(i - 1) !== 0x5c) {
          // Ensure previous char is not whitespace (e.g. avoid false positives on '$50 and $100')
          if (!/\s/.test(state.src[i - 1])) {
            match = i;
            break;
          }
        }
      } else {
        if (state.src.slice(i, i + 2) === "\\)" && state.src.charCodeAt(i - 1) !== 0x5c) {
          match = i;
          break;
        }
      }
    }

    if (match === -1) return false;
    if (silent) return true;

    const content = state.src.slice(start, match).trim();
    if (!content) return false;

    state.pos = match + closeMarker.length;
    const token = state.push("math_inline", "span", 0);
    token.content = content;
    token.markup = openMarker;
    return true;
  }

  md.block.ruler.before("fence", "math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.inline.ruler.before("escape", "math_inline", mathInline);

  md.renderer.rules.math_block = (tokens: any[], idx: number) => {
    const clean = sanitizeLatex(tokens[idx].content);
    return (
      '<div data-type="mathNode" data-display="yes" data-latex="' +
      encodeURIComponent(clean) +
      '"></div>\n'
    );
  };

  md.renderer.rules.math_inline = (tokens: any[], idx: number) => {
    const clean = sanitizeLatex(tokens[idx].content);
    return (
      '<span data-type="mathNode" data-display="no" data-latex="' +
      encodeURIComponent(clean) +
      '"></span>'
    );
  };
}

/**
 * Custom CodeBlock extension with Lowlight syntax highlighting, language badges, and copy functionality
 */
export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
}).configure({
  lowlight,
});

/**
 * Footnote Reference inline node: [^1]
 */
export const FootnoteReference = TiptapNode.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (el) => {
          return (
            el.getAttribute("data-label") ||
            el.textContent?.replace(/[\[\]\^]/g, "").trim() ||
            "1"
          );
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="footnoteReference"]',
      },
      {
        tag: "sup.footnote-ref",
      },
      {
        tag: "sup[data-footnote-ref]",
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = node.attrs.label || "1";
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        class: "theseus-footnote-ref",
        "data-type": "footnoteReference",
        "data-label": label,
      }),
      `[${label}]`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`[^${node.attrs.label || "1"}]`);
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\^([^\]\s]+)\]$/,
        handler: (props) => {
          const label = props.match[1];
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { label } }
            )
            .run();
        },
      }),
    ];
  },
});

/**
 * Footnote Definition block node: [^1]: Definition text
 */
export const FootnoteDefinition = TiptapNode.create({
  name: "footnoteDefinition",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (el) => {
          return el.getAttribute("data-label") || "1";
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="footnoteDefinition"]',
      },
      {
        tag: "li.footnote-item",
        getAttrs: (el) => {
          if (el instanceof HTMLElement) {
            const rawId = el.getAttribute("id") || "";
            return { label: rawId.replace(/^fn/, "") || "1" };
          }
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = node.attrs.label || "1";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "theseus-footnote-definition",
        "data-type": "footnoteDefinition",
        "data-label": label,
      }),
      [
        "span",
        {
          class: "theseus-footnote-label",
          contenteditable: "false",
        },
        `[^${label}]:`,
      ],
      ["div", { class: "theseus-footnote-body" }, 0],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`[^${node.attrs.label || "1"}]: `);
          state.renderInline(node);
          state.write("\n\n");
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\[\^([^\]\s]+)\]:\s$/,
        handler: (props) => {
          const label = props.match[1];
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { label } }
            )
            .run();
        },
      }),
    ];
  },
});

/**
 * Extension that hooks markdown-it plugins (footnotes, definition lists, LaTeX math) into tiptap-markdown
 */
export const MarkdownPlugins = Extension.create({
  name: "markdownPlugins",
  addStorage() {
    return {
      markdown: {
        parse: {
          setup(md: any) {
            const fn = (markdownItFootnote as any)?.default || markdownItFootnote;
            const def = (markdownItDeflist as any)?.default || markdownItDeflist;
            if (typeof fn === "function") md.use(fn);
            if (typeof def === "function") md.use(def);
            md.use(markdownItMath);
          },
          updateDOM(element: HTMLElement) {
            if (typeof window === "undefined" || !element) return;

            // 1. Definition Lists: strip any trailing backslashes from <dt>
            element.querySelectorAll("dt, .theseus-definition-term").forEach((dt) => {
              if (dt.textContent && dt.textContent.includes("\\")) {
                dt.textContent = dt.textContent.replace(/\\+\s*$/, "").trim();
              }
            });

            // 2. Footnotes: transform <section class="footnotes"> and <li class="footnote-item">
            const footnotesSection = element.querySelector("section.footnotes");
            if (footnotesSection) {
              const items = footnotesSection.querySelectorAll("li.footnote-item");
              const defNodes: HTMLElement[] = [];
              items.forEach((item) => {
                const rawId = item.getAttribute("id") || "";
                const label = rawId.replace(/^fn/, "") || "1";
                item.querySelectorAll(".footnote-backref").forEach((br) => br.remove());
                const div = document.createElement("div");
                div.setAttribute("data-type", "footnoteDefinition");
                div.setAttribute("data-label", label);
                const p = item.querySelector("p");
                div.innerHTML = (p ? p.innerHTML : item.innerHTML).trim();
                defNodes.push(div);
              });
              footnotesSection.replaceWith(...defNodes);
            }
            element.querySelectorAll("hr.footnotes-sep").forEach((hr) => hr.remove());

            // 3. Footnote references in <sup class="footnote-ref">
            element.querySelectorAll("sup.footnote-ref").forEach((sup) => {
              const link = sup.querySelector("a");
              const text = (link ? link.textContent : sup.textContent) || "1";
              const label = text.replace(/[\[\]\^]/g, "").trim() || "1";
              const span = document.createElement("span");
              span.setAttribute("data-type", "footnoteReference");
              span.setAttribute("data-label", label);
              span.textContent = `[${label}]`;
              sup.replaceWith(span);
            });

            // 4. Raw unparsed footnote definitions in paragraphs: <p>[^1]: Content</p>
            element.querySelectorAll("p").forEach((p) => {
              const match = p.innerHTML.match(/^\s*\[\^([^\]\s]+)\]:\s*([\s\S]+)$/);
              if (match) {
                const label = match[1];
                const content = match[2];
                const div = document.createElement("div");
                div.setAttribute("data-type", "footnoteDefinition");
                div.setAttribute("data-label", label);
                div.innerHTML = content.trim();
                p.replaceWith(div);
              }
            });

            // 5. Raw unparsed footnote references in text nodes: [^1]
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let textNode: Node | null;
            const textNodesToFix: ChildNode[] = [];
            while ((textNode = walker.nextNode())) {
              if (textNode.nodeValue && /\[\^([^\]\s]+)\]/.test(textNode.nodeValue)) {
                const parent = textNode.parentElement;
                if (!parent?.closest('[data-type="footnoteReference"], [data-type="footnoteDefinition"], pre, code')) {
                  textNodesToFix.push(textNode as ChildNode);
                }
              }
            }
            for (const tn of textNodesToFix) {
              const val = tn.nodeValue || "";
              const replaced = val.replace(/\[\^([^\]\s]+)\]/g, (_, label) => {
                return `<span data-type="footnoteReference" data-label="${label}">[${label}]</span>`;
              });
              if (replaced !== val) {
                const temp = document.createElement("span");
                temp.innerHTML = replaced;
                tn.replaceWith(...Array.from(temp.childNodes));
              }
            }
          },
        },
      },
    };
  },
});

/**
 * Custom TipTap TaskList extension with support for ChatGPT/GFM classes
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
 * Custom TipTap TaskItem extension extracting checkboxes correctly
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
            "input[type='checkbox']"
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
        contentElement: (element) => {
          return element.querySelector("div") ?? element;
        },
      },
      {
        tag: "li.task-list-item",
        priority: 70,
        contentElement: (element) => {
          return element.querySelector("div") ?? element;
        },
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
        contentElement: (element) => {
          return element.querySelector("div") ?? element;
        },
      },
    ];
  },
});

/**
 * Custom TipTap Image extension with width & alignment serialization to Markdown
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
        parseHTML: (element) => {
          return (
            element.getAttribute("data-align") ||
            element.style.textAlign ||
            "left"
          );
        },
        renderHTML: (attributes) => {
          if (!attributes.textAlign || attributes.textAlign === "left")
            return {};
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

/**
 * Custom Underline extension with <u> markdown serialization
 */
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

/**
 * Custom Highlight extension with == markdown serialization
 */
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
 * Custom TipTap FontSize mark extension with HTML span style serialization
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
        parseHTML: (element) => {
          return (
            element.style.fontSize ||
            element.getAttribute("data-font-size") ||
            null
          );
        },
        renderHTML: (attributes) => {
          if (!attributes.size) {
            return {};
          }
          return {
            style: `font-size: ${attributes.size}`,
            "data-font-size": attributes.size,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[style*='font-size']",
      },
      {
        tag: "span[data-font-size]",
      },
    ];
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
        ({ chain }) => {
          return chain().setMark(this.name, { size }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name).run();
        },
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
 * Custom keyboard shortcuts for rich formatting
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

export const SearchHighlightPluginKey = new PluginKey("searchHighlight");

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchPluginState {
  searchTerm: string;
  currentIndex: number;
  matches: SearchMatch[];
  decorations: DecorationSet;
}

function computeSearchState(
  doc: PMNode,
  term: string,
  targetIndex: number,
): SearchPluginState {
  const clean = term.trim().toLowerCase();
  if (!clean) {
    return {
      searchTerm: "",
      currentIndex: 0,
      matches: [],
      decorations: DecorationSet.empty,
    };
  }

  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase();
      let idx = text.indexOf(clean);
      while (idx !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + clean.length });
        idx = text.indexOf(clean, idx + clean.length);
      }
    }
  });

  let currentIndex = 0;
  if (matches.length > 0) {
    if (targetIndex >= 0 && targetIndex < matches.length) {
      currentIndex = targetIndex;
    } else if (targetIndex >= matches.length) {
      currentIndex = 0;
    } else if (targetIndex < 0) {
      currentIndex = matches.length - 1;
    }
  }

  const decorations = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class:
        i === currentIndex
          ? "editor-search-match editor-search-match-active"
          : "editor-search-match",
    }),
  );

  return {
    searchTerm: term,
    currentIndex,
    matches,
    decorations: DecorationSet.create(doc, decorations),
  };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      nextSearchMatch: () => ReturnType;
      prevSearchMatch: () => ReturnType;
    };
  }
}

/**
 * Custom live search highlight extension for TipTap editor
 */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SearchHighlightPluginKey, {
              type: "setTerm",
              term: searchTerm,
            });
          }
          return true;
        },
      nextSearchMatch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SearchHighlightPluginKey, { type: "next" });
          }
          return true;
        },
      prevSearchMatch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SearchHighlightPluginKey, { type: "prev" });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SearchHighlightPluginKey,
        state: {
          init(_, state): SearchPluginState {
            return computeSearchState(state.doc, "", 0);
          },
          apply(
            tr,
            prev: SearchPluginState,
            _oldState,
            newState,
          ): SearchPluginState {
            const meta = tr.getMeta(SearchHighlightPluginKey);
            if (meta) {
              if (meta.type === "setTerm") {
                return computeSearchState(newState.doc, meta.term, 0);
              }
              if (meta.type === "next") {
                const nextIdx =
                  prev.matches.length > 0
                    ? (prev.currentIndex + 1) % prev.matches.length
                    : 0;
                return computeSearchState(
                  newState.doc,
                  prev.searchTerm,
                  nextIdx,
                );
              }
              if (meta.type === "prev") {
                const prevIdx =
                  prev.matches.length > 0
                    ? (prev.currentIndex - 1 + prev.matches.length) %
                      prev.matches.length
                    : 0;
                return computeSearchState(
                  newState.doc,
                  prev.searchTerm,
                  prevIdx,
                );
              }
            }
            if (tr.docChanged) {
              return computeSearchState(
                newState.doc,
                prev.searchTerm,
                prev.currentIndex,
              );
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            const pluginState = SearchHighlightPluginKey.getState(state);
            return pluginState ? pluginState.decorations : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/**
 * Extracts serialized markdown from a TipTap editor instance safely
 */
export const getEditorMarkdown = (editor: any): string => {
  if (!editor) return "";
  return (editor.storage as any)?.markdown?.getMarkdown?.() ?? "";
};

/**
 * Creates standard TipTap extensions for Theseus editors
 */
export function createTipTapExtensions(options?: {
  placeholder?: string;
  withImages?: boolean;
}) {
  const exts: any[] = [
    StarterKit.configure({
      link: false,
      underline: false,
      codeBlock: false,
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),
    CustomCodeBlock,
    FootnoteReference,
    FootnoteDefinition,
    CustomUnderline,
    CustomHighlight,
    CustomFontSize,
    CustomTaskList,
    CustomTaskItem.configure({
      nested: true,
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: "theseus-editor-table",
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    MathNode,
    Superscript,
    DefinitionList,
    DefinitionTerm,
    DefinitionDescription,
    MarkdownPlugins,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Link.configure({
      openOnClick: false,
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: "-",
      transformPastedText: true,
      transformCopiedText: true,
    }),
    CustomShortcuts,
    SearchHighlight,
  ];

  if (options?.placeholder) {
    exts.push(
      Placeholder.configure({
        placeholder: options.placeholder,
      }),
    );
  }

  if (options?.withImages) {
    exts.push(CustomImage);
  }

  return exts;
}
