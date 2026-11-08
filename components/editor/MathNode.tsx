"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Node as TiptapNode,
  mergeAttributes,
  PasteRule,
  InputRule,
} from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import katex from "katex";
import { Edit2, Check, X, Trash2 } from "lucide-react";

/**
 * Sanitizes LaTeX code before rendering in KaTeX:
 * - Decodes URL encoded strings if needed
 * - Normalizes doubled backslashes like \\begin, \\end, \\text, etc. to single backslashes
 * - Fixes matrix / array / cases / aligned row breaks: ensures rows with '&' are separated by \\
 */
export function sanitizeLatex(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Decode if URL encoded
  try {
    if (s.includes("%")) {
      s = decodeURIComponent(s);
    }
  } catch {}

  // 1. Normalize doubled backslashes before LaTeX keywords / commands
  s = s.replace(/\\\\+([a-zA-Z]+)/g, "\\$1");

  // 2. Fix matrix / array / cases / aligned environments:
  // Ensures rows are properly delimited by \\ rather than single \ or plain \n
  s = s.replace(
    /(\\begin\{([bBpvV]?matrix|cases|array|aligned?|gathered?)\})([\s\S]*?)(\\end\{\2\})/g,
    (_, openTag, _envName, body, closeTag) => {
      const fixedBody = body
        // Fix single backslash row breaks like ' \ 4 & 5' or ' \\\n'
        .replace(/([^\\])\\\s+(?=[^&]*&)/g, "$1 \\\\ ")
        // Fix plain newlines between rows that have '&':
        .replace(/(&[^&\r\n]+)(\r?\n)(?=\s*[^&\r\n]+&)/g, "$1 \\\\$2");

      return openTag + fixedBody + closeTag;
    },
  );

  // 3. Fix unescaped underscores, percent signs, and ampersands inside \text{...}, \textbf{...}, \textit{...}, etc.
  s = s.replace(
    /(\\text(?:bf|it|sf|tt|normal)?\{)([^{}]*?)(\})/g,
    (_, openTag, innerText, closeTag) => {
      const fixedText = innerText
        .replace(/(?<!\\)_/g, "\\_")
        .replace(/(?<!\\)%/g, "\\%")
        .replace(/(?<!\\)&/g, "\\&")
        .replace(/(?<!\\)#/g, "\\#");
      return openTag + fixedText + closeTag;
    },
  );

  // 4. Convert unescaped percent signs after numbers/variables/closing brackets (e.g. 50%) to \%
  s = s.replace(/([0-9a-zA-Z\)\}\]])\s*%(?!\n)/g, "$1\\%");

  return s;
}

/**
 * Transforms math delimiters in an HTML element tree into TipTap-compatible mathNode spans.
 * Used during Markdown parsing and clipboard pasting.
 */
export function transformMathInElement(element: HTMLElement) {
  if (typeof window === "undefined" || !element) return;

  // 1. Normalize multiline block formulas spanning across <br> or block containers
  const blockContainers = element.querySelectorAll(
    "p, div, li, blockquote, dd",
  );
  for (const block of Array.from(blockContainers)) {
    if (block.innerHTML.includes("$$") || block.innerHTML.includes("\\[")) {
      const updated = block.innerHTML
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
          const clean = sanitizeLatex(
            math.replace(/<br\s*\/?>/gi, "\n").trim(),
          );
          return `<span data-type="mathNode" data-display="yes" data-latex="${encodeURIComponent(clean)}"></span>`;
        })
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
          const clean = sanitizeLatex(
            math.replace(/<br\s*\/?>/gi, "\n").trim(),
          );
          return `<span data-type="mathNode" data-display="yes" data-latex="${encodeURIComponent(clean)}"></span>`;
        });
      if (updated !== block.innerHTML) {
        block.innerHTML = updated;
      }
    }
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        parent &&
        ["CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  const blockDollarRegex = /\$\$([\s\S]*?)\$\$/g;
  const blockBracketRegex = /\\\[([\s\S]*?)\\\]/g;
  const inlineDollarRegex = /(?<!\$)\$(?!\$)((?:[^$\\\n]|\\.)+?)\$/g;
  const inlineBracketRegex = /\\\(([\s\S]*?)\\\)/g;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue || "";
    if (!text.includes("$") && !text.includes("\\[") && !text.includes("\\(")) {
      continue;
    }

    let modified = text
      .replace(blockDollarRegex, (_, l) => {
        return `<span data-type="mathNode" data-display="yes" data-latex="${encodeURIComponent(
          l.trim(),
        )}"></span>`;
      })
      .replace(blockBracketRegex, (_, l) => {
        return `<span data-type="mathNode" data-display="yes" data-latex="${encodeURIComponent(
          l.trim(),
        )}"></span>`;
      })
      .replace(inlineBracketRegex, (_, l) => {
        return `<span data-type="mathNode" data-display="no" data-latex="${encodeURIComponent(
          l.trim(),
        )}"></span>`;
      })
      .replace(inlineDollarRegex, (_, l) => {
        return `<span data-type="mathNode" data-display="no" data-latex="${encodeURIComponent(
          l.trim(),
        )}"></span>`;
      });

    if (modified !== text) {
      const span = document.createElement("span");
      span.innerHTML = modified;
      textNode.replaceWith(...Array.from(span.childNodes));
    }
  }
}

/**
 * Interactive React NodeView for mathematical expressions
 */
export function MathNodeView(props: any) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const [isEditing, setIsEditing] = useState(false);
  const displayMode = node.attrs.display === "yes";
  const sanitizedLatex = useMemo(
    () => sanitizeLatex(node.attrs.latex || ""),
    [node.attrs.latex],
  );
  const [latexInput, setLatexInput] = useState(sanitizedLatex);
  const [isDisplay, setIsDisplay] = useState(displayMode);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    setLatexInput(sanitizedLatex);
    setIsDisplay(node.attrs.display === "yes");
  }, [sanitizedLatex, node.attrs.display]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const renderedHtml = useMemo(() => {
    try {
      return katex.renderToString(sanitizedLatex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span class="text-rose-500 font-mono text-xs">Invalid LaTeX</span>`;
    }
  }, [sanitizedLatex, displayMode]);

  const previewHtml = useMemo(() => {
    try {
      return katex.renderToString(sanitizeLatex(latexInput || " "), {
        displayMode: isDisplay,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span class="text-rose-500 font-mono text-xs">Invalid LaTeX</span>`;
    }
  }, [latexInput, isDisplay]);

  const handleSave = () => {
    updateAttributes({
      latex: sanitizeLatex(latexInput),
      display: isDisplay ? "yes" : "no",
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !displayMode)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setLatexInput(node.attrs.latex || "");
      setIsDisplay(node.attrs.display === "yes");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <NodeViewWrapper
        as={displayMode ? "div" : "span"}
        className={`relative inline-block ${
          displayMode ? "w-full my-3" : "my-1"
        }`}
      >
        <div className="bg-card border border-accent/40 rounded-lg p-3 shadow-lg space-y-2 max-w-lg z-20">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2 text-xs text-foreground-subtle">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              LaTeX Formula Editor
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDisplay(!isDisplay)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  isDisplay
                    ? "bg-accent/20 text-accent font-semibold"
                    : "bg-subtle text-foreground-subtle hover:text-foreground"
                }`}
                title="Toggle inline or block display mode"
              >
                {isDisplay ? "Block mode" : "Inline mode"}
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="text-rose-400 hover:text-rose-500 p-1"
                title="Delete formula"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            {isDisplay ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={latexInput}
                onChange={(e) => setLatexInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter LaTeX formula, e.g. \int_0^\infty e^{-x} dx = 1"
                className="w-full bg-subtle border border-border rounded-sm px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-hidden focus:border-accent min-h-[60px]"
                rows={3}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={latexInput}
                onChange={(e) => setLatexInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter LaTeX formula, e.g. E = mc^2"
                className="w-full bg-subtle border border-border rounded-sm px-2.5 py-1 text-xs font-mono text-foreground focus:outline-hidden focus:border-accent"
              />
            )}
          </div>

          <div className="bg-subtle/60 border border-border/50 rounded-sm p-2 text-center overflow-x-auto min-h-[36px] flex items-center justify-center">
            <span
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              className="text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setLatexInput(node.attrs.latex || "");
                setIsDisplay(node.attrs.display === "yes");
                setIsEditing(false);
              }}
              className="px-2.5 py-1 rounded-sm text-foreground-subtle hover:text-foreground hover:bg-subtle transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 rounded-sm bg-accent text-white font-medium hover:bg-accent/90 transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as={displayMode ? "div" : "span"}
      className={`group relative ${
        displayMode ? "theseus-math-block" : "theseus-math-inline"
      } ${selected ? "ring-2 ring-accent" : ""}`}
      onDoubleClick={() => setIsEditing(true)}
      title="Double click to edit LaTeX equation"
    >
      <span
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        className="select-text"
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 hover:bg-card border border-border p-1 rounded-sm shadow-2xs text-foreground-subtle hover:text-foreground"
        title="Edit LaTeX formula"
      >
        <Edit2 className="w-3 h-3" />
      </button>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathNode: {
      insertMath: (options?: {
        latex?: string;
        display?: boolean;
      }) => ReturnType;
    };
  }
}

/**
 * Custom TipTap Node for Mathematical LaTeX Expressions
 */
export const MathNode = TiptapNode.create({
  name: "mathNode",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => {
          const dataLatex = element.getAttribute("data-latex");
          if (dataLatex) {
            return sanitizeLatex(dataLatex);
          }
          const annotation = element.querySelector(
            'annotation[encoding="application/x-tex"]',
          );
          if (annotation?.textContent) {
            return sanitizeLatex(annotation.textContent);
          }
          return sanitizeLatex(element.textContent || "");
        },
        renderHTML: (attributes) => ({
          "data-latex": encodeURIComponent(attributes.latex || ""),
        }),
      },
      display: {
        default: "no",
        parseHTML: (element) => {
          const dataDisplay = element.getAttribute("data-display");
          if (dataDisplay === "yes" || dataDisplay === "true") return "yes";
          if (
            element.classList.contains("katex-display") ||
            element.classList.contains("math-display") ||
            element.closest(".katex-display")
          ) {
            return "yes";
          }
          return "no";
        },
        renderHTML: (attributes) => ({
          "data-display": attributes.display || "no",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="mathNode"]',
        priority: 70,
      },
      {
        tag: 'div[data-type="mathNode"]',
        priority: 70,
      },
      {
        tag: "div.katex-display",
        priority: 65,
      },
      {
        tag: "span.katex",
        priority: 60,
        getAttrs: (element) => {
          if (
            element instanceof HTMLElement &&
            element.closest(".katex-display")
          ) {
            return false;
          }
          return {};
        },
      },
      {
        tag: "span.math.inline",
        priority: 60,
      },
      {
        tag: "div.math.display",
        priority: 65,
      },
      {
        tag: "span.tiptap-math",
        priority: 60,
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const isBlock = node.attrs.display === "yes";
    return [
      isBlock ? "div" : "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "mathNode",
        class: isBlock ? "theseus-math-block" : "theseus-math-inline",
      }),
      isBlock ? `\\[${node.attrs.latex}\\]` : `\\(${node.attrs.latex}\\)`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },

  addCommands() {
    return {
      insertMath:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              latex: options?.latex || "E = mc^2",
              display: options?.display ? "yes" : "no",
            },
          });
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const isBlock = node.attrs.display === "yes";
          if (isBlock) {
            state.write(`\n\n$$\n${node.attrs.latex}\n$$\n\n`);
          } else {
            state.write(`$${node.attrs.latex}$`);
          }
        },
        parse: {
          updateDOM(element: HTMLElement) {
            transformMathInElement(element);
          },
        },
      },
    };
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /\$\$([\s\S]*?)\$\$/g,
        handler: (props) => {
          const latex = sanitizeLatex(props.match[1]);
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex, display: "yes" } },
            )
            .run();
        },
      }),
      new PasteRule({
        find: /\\\[([\s\S]*?)\\\]/g,
        handler: (props) => {
          const latex = sanitizeLatex(props.match[1]);
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex, display: "yes" } },
            )
            .run();
        },
      }),
      new PasteRule({
        find: /\\\(([\s\S]*?)\\\)/g,
        handler: (props) => {
          const latex = sanitizeLatex(props.match[1]);
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex, display: "no" } },
            )
            .run();
        },
      }),
      new PasteRule({
        find: /(?<!\$)\$(?!\$)((?:[^$\\\n]|\\.)+?)\$/g,
        handler: (props) => {
          const latex = sanitizeLatex(props.match[1]);
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex, display: "no" } },
            )
            .run();
        },
      }),
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: (props) => {
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex: "E = mc^2", display: "yes" } },
            )
            .run();
        },
      }),
      new InputRule({
        find: /\$\$([^\$\n]+)\$\$$/,
        handler: (props) => {
          const latex = props.match[1].trim();
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex, display: "yes" } },
            )
            .run();
        },
      }),
      new InputRule({
        find: /(?<!\$)\$([^\$\n]+)\$$/,
        handler: (props) => {
          const latex = props.match[1].trim();
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { latex, display: "no" } },
            )
            .run();
        },
      }),
    ];
  },
});
