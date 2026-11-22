"use client";

import React from "react";
import ReactMarkdown, { Components, defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import katex from "katex";
import { parseYouTubeEmbedMeta, parseYouTubeUrl } from "@/lib/youtube";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { sanitizeLatex } from "@/components/editor/MathNode";

interface MarkdownRendererProps {
  content: string;
  emptyPlaceholder?: string;
  className?: string;
}

const SAFE_ALIGN_REGEX = /^(left|center|right|justify|start|end)$/i;
const SAFE_FONT_SIZE_REGEX = /^\d+(?:\.\d+)?(?:px|em|rem|%)$/i;
const SAFE_DATA_IMAGE_REGEX =
  /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif);base64,[a-z0-9+/=\s]+$/i;

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseTagAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex =
    /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrStr)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = decodeBasicEntities(val);
  }
  return attrs;
}

function extractSafeFontSize(attrs: Record<string, string>): string | null {
  const dataSize = attrs["data-font-size"]?.trim();
  if (dataSize && SAFE_FONT_SIZE_REGEX.test(dataSize)) {
    return dataSize.toLowerCase();
  }
  const style = attrs.style || "";
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const val = part.slice(colon + 1).trim();
    if (prop === "font-size" && SAFE_FONT_SIZE_REGEX.test(val)) {
      return val.toLowerCase();
    }
  }
  return null;
}

function extractSafeAlign(attrs: Record<string, string>): string | null {
  const dataAlign = attrs["data-align"]?.trim();
  if (dataAlign && SAFE_ALIGN_REGEX.test(dataAlign)) {
    return dataAlign.toLowerCase();
  }
  const style = attrs.style || "";
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const val = part.slice(colon + 1).trim();
    if (prop === "text-align" && SAFE_ALIGN_REGEX.test(val)) {
      return val.toLowerCase();
    }
  }
  return null;
}

function isSafeImageSrc(src: string): boolean {
  const cleaned = src.replace(/[\u0000-\u0020]+/g, "").trim();
  if (!cleaned) return false;
  if (SAFE_DATA_IMAGE_REGEX.test(cleaned)) return true;
  return Boolean(defaultUrlTransform(cleaned));
}

function splitTextWithMathAndHighlight(text: string): any[] {
  if (
    !text.includes("$") &&
    !text.includes("\\[") &&
    !text.includes("\\(") &&
    !text.includes("==")
  ) {
    return [{ type: "text", value: text }];
  }

  const tokenRegex =
    /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\$)\$(?!\$)((?:[^$\\\n]|\\.)+?)\$|(?<!\\)==(?!=)(?!\s)([^=\n]+?)(?<!\s)==/g;

  const nodes: any[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined || match[2] !== undefined) {
      nodes.push({
        type: "element",
        tagName: "span",
        properties: {
          "data-theseus-math": "block",
          "data-latex": (match[1] ?? match[2] ?? "").trim(),
        },
        children: [],
      });
    } else if (match[3] !== undefined || match[4] !== undefined) {
      nodes.push({
        type: "element",
        tagName: "span",
        properties: {
          "data-theseus-math": "inline",
          "data-latex": (match[3] ?? match[4] ?? "").trim(),
        },
        children: [],
      });
    } else if (match[5] !== undefined) {
      nodes.push({
        type: "element",
        tagName: "mark",
        properties: {},
        children: [{ type: "text", value: match[5] }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    return [{ type: "text", value: text }];
  }
  if (lastIndex < text.length) {
    nodes.push({ type: "text", value: text.slice(lastIndex) });
  }
  return nodes;
}

const SIMPLE_INLINE_TAGS = new Set([
  "u",
  "mark",
  "sup",
  "sub",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "del",
  "code",
]);

function parseSafeImgRaw(raw: string): any | null {
  const imgMatch = raw.trim().match(/^<img\b([\s\S]*?)\/?>$/i);
  if (!imgMatch) return null;
  const attrs = parseTagAttrs(imgMatch[1]);
  if (!attrs.src || !isSafeImageSrc(attrs.src)) return null;

  const properties: Record<string, any> = {
    src: attrs.src,
  };
  if (attrs.alt !== undefined) properties.alt = attrs.alt;
  if (attrs.title) properties.title = attrs.title;
  if (attrs.width) {
    const parsedW = parseInt(attrs.width, 10);
    if (!Number.isNaN(parsedW) && parsedW > 0) properties.width = parsedW;
  }
  const align = extractSafeAlign(attrs);
  if (align) properties["data-align"] = align;

  return {
    type: "element",
    tagName: "img",
    properties,
    children: [],
  };
}

/**
 * Strictly allowlisted inline HTML parser for the inner HTML of aligned <p>/<h1-h6> blocks
 * emitted by TipTap's Markdown serializer. Any unknown tag or unsafe attribute is escaped as text.
 */
function parseSafeInlineHtml(html: string): any[] {
  const tokenRegex = /(<\/?[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\/?>)/g;
  const parts = html.split(tokenRegex).filter((p) => p.length > 0);
  const hastChildren: any[] = [];

  for (const part of parts) {
    if (part.startsWith("<") && part.endsWith(">")) {
      hastChildren.push({ type: "raw", value: part });
    } else {
      hastChildren.push({ type: "text", value: decodeBasicEntities(part) });
    }
  }

  return transformInlineChildren(hastChildren, true);
}

function tryOpenAllowlistedInlineTag(
  rawValue: string,
  allowExtendedInline: boolean,
): { tagName: string; properties: Record<string, any> } | null {
  const trimmed = rawValue.trim();

  // Simple opening tag: <u>, <mark>, <sup>, <sub> (plus <strong>, <em>, <s>, <code> inside aligned HTML blocks)
  const simpleMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9]*)\s*>$/);
  if (simpleMatch) {
    const tag = simpleMatch[1].toLowerCase();
    if (
      tag === "u" ||
      tag === "mark" ||
      tag === "sup" ||
      tag === "sub" ||
      (allowExtendedInline && SIMPLE_INLINE_TAGS.has(tag))
    ) {
      return { tagName: tag, properties: {} };
    }
    return null;
  }

  // <span ...> with safe font-size OR mathNode attributes
  const spanMatch = trimmed.match(/^<span\b([\s\S]*?)>$/i);
  if (spanMatch) {
    const attrs = parseTagAttrs(spanMatch[1]);
    if (attrs["data-type"] === "mathnode" && attrs["data-latex"]) {
      let decoded = attrs["data-latex"];
      try {
        decoded = decodeURIComponent(decoded);
      } catch {}
      return {
        tagName: "span",
        properties: {
          "data-theseus-math":
            attrs["data-display"] === "yes" ? "block" : "inline",
          "data-latex": decoded,
        },
      };
    }
    const fontSize = extractSafeFontSize(attrs);
    if (fontSize) {
      return {
        tagName: "span",
        properties: { style: `font-size: ${fontSize}` },
      };
    }
    return null;
  }

  // <a href="..."> inside aligned HTML blocks
  if (allowExtendedInline) {
    const aMatch = trimmed.match(/^<a\b([\s\S]*?)>$/i);
    if (aMatch) {
      const attrs = parseTagAttrs(aMatch[1]);
      const safeHref = attrs.href ? defaultUrlTransform(attrs.href) : "";
      if (safeHref) {
        return { tagName: "a", properties: { href: safeHref } };
      }
    }
    const supFnMatch = trimmed.match(/^<sup\b([\s\S]*?)>$/i);
    if (supFnMatch) {
      return { tagName: "sup", properties: {} };
    }
  }

  return null;
}

function transformInlineChildren(
  children: any[],
  allowExtendedInline = false,
): any[] {
  type Frame = {
    tagName: string;
    properties: Record<string, any>;
    rawOpen: string;
    children: any[];
  };

  const rootChildren: any[] = [];
  const stack: Frame[] = [];

  const append = (node: any) => {
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      rootChildren.push(node);
    }
  };

  for (const child of children) {
    if (child.type === "raw" && typeof child.value === "string") {
      const trimmed = child.value.trim();

      // Self-closing <br>
      if (/^<br\s*\/?>$/i.test(trimmed)) {
        append({ type: "element", tagName: "br", properties: {}, children: [] });
        continue;
      }

      // Self-closing or standalone safe <img>
      const safeImg = parseSafeImgRaw(trimmed);
      if (safeImg) {
        append(safeImg);
        continue;
      }

      // Closing tag
      const closeMatch = trimmed.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>$/);
      if (closeMatch) {
        const closeTag = closeMatch[1].toLowerCase();
        const matchIdx = stack.findLastIndex((f) => f.tagName === closeTag);
        if (matchIdx !== -1) {
          // Unwind any unclosed inner frames as text
          while (stack.length - 1 > matchIdx) {
            const unclosed = stack.pop()!;
            append({ type: "text", value: unclosed.rawOpen });
            for (const c of unclosed.children) append(c);
          }
          const frame = stack.pop()!;
          const element = {
            type: "element",
            tagName: frame.tagName,
            properties: frame.properties,
            children:
              frame.properties["data-theseus-math"] ? [] : frame.children,
          };
          append(element);
          continue;
        }
      }

      // Opening allowlisted inline tag
      const opened = tryOpenAllowlistedInlineTag(trimmed, allowExtendedInline);
      if (opened) {
        stack.push({
          tagName: opened.tagName,
          properties: opened.properties,
          rawOpen: child.value,
          children: [],
        });
        continue;
      }

      // Any non-allowlisted raw HTML stays escaped as plain text
      append({ type: "text", value: child.value });
      continue;
    }

    if (child.type === "text" && typeof child.value === "string") {
      const insideCode = stack.some((f) => f.tagName === "code");
      const insideMath = stack.some((f) => Boolean(f.properties["data-theseus-math"]));
      if (insideMath) {
        // Fallback text inside <span data-type="mathNode">\(..\)</span> is discarded; data-latex is used.
        continue;
      }
      if (insideCode) {
        append(child);
      } else {
        for (const piece of splitTextWithMathAndHighlight(child.value)) {
          append(piece);
        }
      }
      continue;
    }

    if (child.type === "element") {
      const tag = (child.tagName || "").toLowerCase();
      if (tag !== "code" && tag !== "pre" && Array.isArray(child.children)) {
        child.children = transformInlineChildren(
          child.children,
          allowExtendedInline,
        );
      }
      append(child);
      continue;
    }

    append(child);
  }

  // Flush any unclosed frames safely as plain text + children
  while (stack.length > 0) {
    const unclosed = stack.pop()!;
    const target =
      stack.length > 0 ? stack[stack.length - 1].children : rootChildren;
    target.push({ type: "text", value: unclosed.rawOpen }, ...unclosed.children);
  }

  return rootChildren;
}

function tryTransformBlockRaw(rawValue: string): any | null {
  const trimmed = rawValue.trim();

  // Standalone resized/aligned <img>
  const safeImg = parseSafeImgRaw(trimmed);
  if (safeImg) return safeImg;

  // Aligned <p style="text-align: ...">...</p> or <h1..h6 style="text-align: ...">...</h1..h6>
  const blockMatch = trimmed.match(
    /^<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>$/i,
  );
  if (blockMatch) {
    const tagName = blockMatch[1].toLowerCase();
    const attrs = parseTagAttrs(blockMatch[2]);
    const align = extractSafeAlign(attrs);
    if (align) {
      return {
        type: "element",
        tagName,
        properties: { style: `text-align: ${align}` },
        children: parseSafeInlineHtml(blockMatch[3]),
      };
    }
  }

  return null;
}

/**
 * Lightweight zero-dependency rehype plugin for safe TipTap formatting round-trip:
 * supports underline (<u>), highlight (<mark> and ==...==), font-size (<span style="font-size: ...">),
 * aligned blocks (<p>/<h1-6 style="text-align: ...">), resized <img>, and KaTeX math ($...$, $$...$$).
 * Non-allowlisted raw HTML is converted to plain text to prevent XSS.
 */
export function rehypeTheseusFormatting() {
  return function transform(tree: any) {
    const walkContainer = (node: any) => {
      if (!node || !Array.isArray(node.children)) return;
      const tag = node.type === "element" ? (node.tagName || "").toLowerCase() : "";
      if (tag === "code" || tag === "pre") return;

      // First convert any block-level allowlisted raw HTML nodes
      const mapped: any[] = [];
      for (const child of node.children) {
        if (child.type === "raw" && typeof child.value === "string") {
          const blockEl = tryTransformBlockRaw(child.value);
          if (blockEl) {
            mapped.push(blockEl);
            continue;
          }
        }
        mapped.push(child);
      }

      if (
        node.type === "root" ||
        tag === "blockquote" ||
        tag === "ul" ||
        tag === "ol" ||
        tag === "table" ||
        tag === "thead" ||
        tag === "tbody" ||
        tag === "tr"
      ) {
        node.children = mapped.map((child) => {
          if (child.type === "raw" && typeof child.value === "string") {
            return { type: "text", value: child.value };
          }
          walkContainer(child);
          return child;
        });
      } else {
        node.children = transformInlineChildren(mapped, false);
      }
    };

    walkContainer(tree);
  };
}

function safeUrlTransform(url: string, key: string, node: any): string {
  if (
    key === "src" &&
    node?.tagName === "img" &&
    SAFE_DATA_IMAGE_REGEX.test(url.replace(/[\u0000-\u0020]+/g, "").trim())
  ) {
    return url;
  }
  return defaultUrlTransform(url);
}

const customComponents: Components = {
  h1: ({ children, style }) => (
    <h1
      style={style}
      className="text-2xl font-bold text-foreground mt-5 first:mt-0 mb-2.5 last:mb-0 pb-1.5 border-b border-border-subtle tracking-tight font-manrope"
    >
      {children}
    </h1>
  ),
  h2: ({ children, style }) => (
    <h2
      style={style}
      className="text-xl font-bold text-foreground mt-4 first:mt-0 mb-2 last:mb-0 pb-1 border-b border-border-subtle tracking-tight font-manrope"
    >
      {children}
    </h2>
  ),
  h3: ({ children, style }) => (
    <h3
      style={style}
      className="text-base font-semibold text-foreground mt-3.5 first:mt-0 mb-1.5 last:mb-0 tracking-tight font-manrope"
    >
      {children}
    </h3>
  ),
  h4: ({ children, style }) => (
    <h4
      style={style}
      className="text-sm font-semibold text-foreground mt-3 first:mt-0 mb-1 last:mb-0 font-manrope"
    >
      {children}
    </h4>
  ),
  p: ({ node, children, style }) => {
    const elementChildren = node?.children?.filter(
      (child) => !(child.type === "text" && !child.value.trim()),
    );
    const hasBlockMedia = elementChildren?.some(
      (child) =>
        child.type === "element" &&
        (child.tagName === "img" ||
          child.properties?.["data-theseus-math"] === "block"),
    );
    if (hasBlockMedia) {
      if (elementChildren?.length === 1) {
        return <>{children}</>;
      }
      return (
        <div
          style={style}
          className="text-xs sm:text-sm text-foreground-subtle leading-relaxed mt-0 mb-3 last:mb-0 font-manrope"
        >
          {children}
        </div>
      );
    }
    return (
      <p
        style={style}
        className="text-xs sm:text-sm text-foreground-subtle leading-relaxed mt-0 mb-3 last:mb-0 font-manrope"
      >
        {children}
      </p>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 mt-0 mb-3 last:mb-0 text-xs sm:text-sm text-foreground-subtle space-y-1 font-manrope">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 mt-0 mb-3 last:mb-0 text-xs sm:text-sm text-foreground-subtle space-y-1 font-manrope">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-foreground-subtle leading-relaxed font-manrope pl-0.5 my-0">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-accent pl-4 py-1.5 my-3 first:mt-0 last:mb-0 text-xs sm:text-sm italic text-foreground-subtle bg-accent-subtle rounded-r font-manrope">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="p-3.5 my-3 first:mt-0 last:mb-0 max-w-full rounded-xl bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed border border-border shadow-2xs">
      {children}
    </pre>
  ),
  code({ className, children, ...props }) {
    const isInline = !className && !String(children).includes("\n");
    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded-sm bg-subtle border border-border font-mono text-[11px] text-foreground font-medium before:content-none after:content-none before:hidden after:hidden"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground font-manrope">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground-subtle font-manrope">{children}</em>
  ),
  mark: ({ children }) => (
    <mark className="bg-amber-200/70 dark:bg-amber-400/25 text-foreground rounded-xs px-0.5">
      {children}
    </mark>
  ),
  span: ({ children, style, ...props }: any) => {
    const mathKind = props["data-theseus-math"];
    if (mathKind === "block" || mathKind === "inline") {
      const displayMode = mathKind === "block";
      const rawLatex = String(props["data-latex"] || "");
      let html = "";
      try {
        html = katex.renderToString(sanitizeLatex(rawLatex), {
          displayMode,
          throwOnError: false,
          strict: false,
          trust: false,
        });
      } catch {
        return <code className="font-mono text-xs">{rawLatex}</code>;
      }
      return (
        <span
          className={
            displayMode
              ? "block my-2 overflow-x-auto text-center"
              : "inline-block align-baseline"
          }
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return (
      <span style={style} {...props}>
        {children}
      </span>
    );
  },
  u: ({ children }: any) => <u className="underline underline-offset-2">{children}</u>,
  hr: () => (
    <hr className="my-5 first:mt-0 last:mb-0 border-t border-border-subtle" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 first:mt-0 last:mb-0 max-w-full border border-border rounded-xl">
      <table className="w-full text-xs text-left font-manrope border-collapse wrap-break-word">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-subtle border-b border-border text-foreground font-semibold">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-foreground font-semibold border-r border-border last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-foreground-subtle border-t border-border-subtle border-r border-border last:border-r-0">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline underline-offset-2 transition-colors font-manrope"
    >
      {children}
    </a>
  ),
  img: ({ src, alt, ...props }: any) => {
    if (typeof src === "string" && parseYouTubeUrl(src)) {
      const meta = parseYouTubeEmbedMeta(props.title);
      const embedAlign = meta.align || props["data-align"] || props.align;
      const embedWidth = meta.width ?? props["data-width"] ?? props.width;
      return (
        <YouTubeEmbed
          url={src}
          width={embedWidth}
          align={embedAlign}
          className="my-3 first:mt-0 last:mb-0"
        />
      );
    }
    const align = props["data-align"] || props.align;
    const width = props.width;
    const justifyClass =
      align === "center"
        ? "justify-center"
        : align === "right"
          ? "justify-end"
          : "justify-start";
    return (
      <div className={`w-full flex my-4 first:mt-0 last:mb-0 ${justifyClass}`}>
        <img
          src={src}
          alt={alt || "Image"}
          style={
            width
              ? {
                  width: typeof width === "number" ? `${width}px` : width,
                  maxWidth: "100%",
                }
              : undefined
          }
          className="rounded-xl border border-border max-h-96 object-contain shadow-2xs"
        />
      </div>
    );
  },
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  emptyPlaceholder = "*No content yet*",
  className = "",
}) => {
  return (
    <div
      className={`prose max-w-none min-w-0 wrap-anywhere text-foreground leading-relaxed font-manrope ${className}`}
    >
      {content && content.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeTheseusFormatting]}
          urlTransform={safeUrlTransform}
          components={customComponents}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground italic text-xs sm:text-sm font-manrope my-0">
          {emptyPlaceholder}
        </p>
      )}
    </div>
  );
};
