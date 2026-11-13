"use client";

import React from "react";
import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ExternalLink, Link2 } from "lucide-react";
import {
  extractYouTubeUrlFromPaste,
  formatYouTubeEmbedMeta,
  normalizeMediaAlign,
  parseMediaWidth,
  parseYouTubeEmbedMeta,
  parseYouTubeUrl,
} from "@/lib/youtube";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { ResizableMediaFrame } from "./ResizableMediaFrame";

function extractYouTubeElementAttrs(
  el: HTMLElement,
): { src: string; width: number | null; textAlign: string } | false {
  const src = el.getAttribute("data-src") || el.getAttribute("src") || "";
  const parsed = parseYouTubeUrl(src);
  if (!parsed) return false;

  const titleMeta = parseYouTubeEmbedMeta(el.getAttribute("title"));
  const width =
    parseMediaWidth(
      el.getAttribute("data-width") ||
        el.getAttribute("width") ||
        el.style.width,
    ) ??
    titleMeta.width ??
    null;

  const textAlign = normalizeMediaAlign(
    el.getAttribute("data-align") ||
      el.style.textAlign ||
      titleMeta.align ||
      "left",
  );

  return {
    src: parsed.canonicalUrl,
    width,
    textAlign,
  };
}

const YouTubeNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
  deleteNode,
}) => {
  const src: string = node.attrs.src || "";
  const isEditable = editor?.isEditable ?? false;

  const handleConvertToLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditable || typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos !== "number" || !src) return;

    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: pos, to: pos + node.nodeSize },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: src,
              marks: [{ type: "link", attrs: { href: src } }],
            },
          ],
        },
      )
      .run();
  };

  const actionButtons = (
    <>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={handleConvertToLink}
        className="p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-subtle transition-colors cursor-pointer"
        title="Convert to link"
        aria-label="Convert to link"
      >
        <Link2 className="w-3.5 h-3.5" />
      </button>
      {src && (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-subtle transition-colors"
          title="Open on YouTube"
          aria-label="Open on YouTube"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </>
  );

  return (
    <ResizableMediaFrame
      editor={editor}
      node={node}
      updateAttributes={updateAttributes}
      selected={selected}
      getPos={getPos}
      deleteNode={deleteNode}
      minWidth={160}
      defaultFillWidth
      dataType="youtube"
      deleteLabel="Remove video"
      extraToolbarActions={actionButtons}
    >
      {({ isResizing, isHovered, handleSelect }) => {
        const header = isEditable ? (
          <div
            onClick={handleSelect}
            className="px-2.5 py-1 border-b border-border bg-subtle flex items-center justify-between gap-2 text-[11px] text-muted-foreground select-none cursor-pointer"
            contentEditable={false}
          >
            <span className="font-mono truncate min-w-0 text-[10px]">
              {src}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleConvertToLink}
                className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                title="Convert to link"
                aria-label="Convert to link"
              >
                <Link2 className="w-3 h-3" />
              </button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                title="Open on YouTube"
                aria-label="Open on YouTube"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : null;

        return (
          <YouTubeEmbed
            url={src}
            fullWidth
            disableIframePointerEvents={isResizing}
            header={header}
            className={
              selected
                ? "ring-2 ring-accent ring-offset-2 ring-offset-card"
                : isHovered && isEditable
                  ? "ring-1 ring-border"
                  : ""
            }
          />
        );
      }}
    </ResizableMediaFrame>
  );
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    youtube: {
      setYoutubeVideo: (options: { src: string }) => ReturnType;
    };
  }
}

/**
 * Custom TipTap block node for alignable and resizable embedded YouTube videos with paste detection and Markdown round-trip.
 */
export const YoutubeNode = TiptapNode.create({
  name: "youtube",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-src") || element.getAttribute("src") || "",
        renderHTML: (attributes) =>
          attributes.src ? { "data-src": attributes.src } : {},
      },
      width: {
        default: null,
        parseHTML: (element) =>
          parseMediaWidth(
            element.getAttribute("data-width") ||
              element.getAttribute("width") ||
              element.style.width,
          ),
        renderHTML: (attributes) =>
          attributes.width ? { "data-width": attributes.width } : {},
      },
      textAlign: {
        default: "left",
        parseHTML: (element) =>
          normalizeMediaAlign(
            element.getAttribute("data-align") || element.style.textAlign,
          ),
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

  parseHTML() {
    return [
      {
        tag: 'div[data-type="youtube"]',
        getAttrs: (el) => extractYouTubeElementAttrs(el as HTMLElement),
      },
      {
        tag: "iframe[src]",
        getAttrs: (el) => extractYouTubeElementAttrs(el as HTMLElement),
      },
      {
        tag: "img[src]",
        priority: 80,
        getAttrs: (el) => extractYouTubeElementAttrs(el as HTMLElement),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const src = node.attrs.src || "";
    const parsed = parseYouTubeUrl(src);
    const attrs: Record<string, string> = {
      "data-type": "youtube",
      "data-src": src,
    };
    if (node.attrs.width) {
      attrs["data-width"] = String(node.attrs.width);
    }
    if (node.attrs.textAlign && node.attrs.textAlign !== "left") {
      attrs["data-align"] = node.attrs.textAlign;
    }

    return [
      "div",
      mergeAttributes(HTMLAttributes, attrs),
      parsed
        ? [
            "iframe",
            {
              src: parsed.embedUrl,
              allowfullscreen: "true",
            },
          ]
        : src,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YouTubeNodeView);
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (options) =>
        ({ commands }) => {
          const parsed = parseYouTubeUrl(options.src);
          if (!parsed) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { src: parsed.canonicalUrl },
          });
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const src = node.attrs.src || "";
          if (!src) return;
          const safeSrc = src.replace(/\(/g, "%28").replace(/\)/g, "%29");
          const meta = formatYouTubeEmbedMeta(
            node.attrs.width,
            node.attrs.textAlign,
          );
          const metaSuffix = meta ? ` "${meta}"` : "";
          state.write(`![youtube](${safeSrc}${metaSuffix})`);
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            if (typeof window === "undefined" || !element) return;
            element.querySelectorAll("img[src]").forEach((img) => {
              const src = img.getAttribute("src") || "";
              const parsed = parseYouTubeUrl(src);
              if (!parsed) return;

              const titleMeta = parseYouTubeEmbedMeta(img.getAttribute("title"));
              const width =
                parseMediaWidth(
                  img.getAttribute("data-width") || img.getAttribute("width"),
                ) ?? titleMeta.width;
              const align =
                normalizeMediaAlign(
                  img.getAttribute("data-align") || titleMeta.align,
                );

              const wrapper = document.createElement("div");
              wrapper.setAttribute("data-type", "youtube");
              wrapper.setAttribute("data-src", parsed.canonicalUrl);
              if (width) wrapper.setAttribute("data-width", String(width));
              if (align !== "left") wrapper.setAttribute("data-align", align);

              const parent = img.parentElement;
              if (
                parent &&
                parent.tagName === "P" &&
                parent.childNodes.length === 1
              ) {
                parent.replaceWith(wrapper);
              } else {
                img.replaceWith(wrapper);
              }
            });
          },
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const nodeName = this.name;

    return [
      new Plugin({
        key: new PluginKey("youtubePaste"),
        props: {
          handlePaste: (view, event) => {
            if (!view.editable) return false;

            const { $from, $to } = view.state.selection;
            if ($from.parent.type.spec.code) {
              return false;
            }

            const items = Array.from(event.clipboardData?.items || []);
            if (items.some((item) => item.type.startsWith("image/"))) {
              return false;
            }

            const pastedText = event.clipboardData
              ?.getData("text/plain")
              ?.trim();
            if (!pastedText) return false;

            const parsed = extractYouTubeUrlFromPaste(pastedText);
            if (!parsed) return false;

            event.preventDefault();

            const isAtEndOfDoc = $to.pos >= view.state.doc.content.size - 1;
            const contentToInsert = isAtEndOfDoc
              ? [
                  { type: nodeName, attrs: { src: parsed.canonicalUrl } },
                  { type: "paragraph" },
                ]
              : { type: nodeName, attrs: { src: parsed.canonicalUrl } };

            editor.chain().focus().insertContent(contentToInsert).run();
            return true;
          },
        },
      }),
    ];
  },
});
