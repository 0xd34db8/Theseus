"use client";

import React from "react";
import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { extractYouTubeUrlFromPaste, parseYouTubeUrl } from "@/lib/youtube";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";

const YouTubeNodeView: React.FC<NodeViewProps> = ({
  node,
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

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  };

  const header = isEditable ? (
    <div
      className="px-2.5 py-1 border-b border-border bg-subtle flex items-center justify-between gap-2 text-[11px] text-muted-foreground select-none"
      contentEditable={false}
    >
      <span className="font-mono truncate min-w-0 text-[10px]">{src}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
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
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
          className="p-1 rounded-sm text-muted-foreground hover:text-red-500 hover:bg-card transition-colors cursor-pointer"
          title="Remove video"
          aria-label="Remove video"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <NodeViewWrapper
      className="my-3 first:mt-0 last:mb-0 select-none"
      data-type="youtube"
    >
      <YouTubeEmbed
        url={src}
        header={header}
        className={selected ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""}
      />
    </NodeViewWrapper>
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
 * Custom TipTap block node for embedded YouTube videos with paste detection and Markdown round-trip.
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
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="youtube"]',
        getAttrs: (el) => {
          const src =
            el.getAttribute("data-src") || el.getAttribute("src") || "";
          const parsed = parseYouTubeUrl(src);
          return parsed ? { src: parsed.canonicalUrl } : false;
        },
      },
      {
        tag: "iframe[src]",
        getAttrs: (el) => {
          const src = el.getAttribute("src") || "";
          const parsed = parseYouTubeUrl(src);
          return parsed ? { src: parsed.canonicalUrl } : false;
        },
      },
      {
        tag: "img[src]",
        priority: 80,
        getAttrs: (el) => {
          const src = el.getAttribute("src") || "";
          const parsed = parseYouTubeUrl(src);
          return parsed ? { src: parsed.canonicalUrl } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const src = node.attrs.src || "";
    const parsed = parseYouTubeUrl(src);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "youtube",
        "data-src": src,
      }),
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
          state.write(`![youtube](${safeSrc})`);
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            if (typeof window === "undefined" || !element) return;
            element.querySelectorAll("img[src]").forEach((img) => {
              const src = img.getAttribute("src") || "";
              const parsed = parseYouTubeUrl(src);
              if (!parsed) return;

              const wrapper = document.createElement("div");
              wrapper.setAttribute("data-type", "youtube");
              wrapper.setAttribute("data-src", parsed.canonicalUrl);

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
