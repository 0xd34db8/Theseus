"use client";

import React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseYouTubeUrl } from "@/lib/youtube";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";

interface MarkdownRendererProps {
  content: string;
  emptyPlaceholder?: string;
  className?: string;
}

const customComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-foreground mt-5 first:mt-0 mb-2.5 last:mb-0 pb-1.5 border-b border-border-subtle tracking-tight font-manrope">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-foreground mt-4 first:mt-0 mb-2 last:mb-0 pb-1 border-b border-border-subtle tracking-tight font-manrope">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-foreground mt-3.5 first:mt-0 mb-1.5 last:mb-0 tracking-tight font-manrope">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-foreground mt-3 first:mt-0 mb-1 last:mb-0 font-manrope">
      {children}
    </h4>
  ),
  p: ({ node, children }) => {
    const elementChildren = node?.children?.filter(
      (child) => !(child.type === "text" && !child.value.trim()),
    );
    const hasBlockMedia = elementChildren?.some(
      (child) => child.type === "element" && child.tagName === "img",
    );
    if (hasBlockMedia) {
      if (elementChildren?.length === 1) {
        return <>{children}</>;
      }
      return (
        <div className="text-xs sm:text-sm text-foreground-subtle leading-relaxed mt-0 mb-3 last:mb-0 font-manrope">
          {children}
        </div>
      );
    }
    return (
      <p className="text-xs sm:text-sm text-foreground-subtle leading-relaxed mt-0 mb-3 last:mb-0 font-manrope">
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
  span: ({ children, style, ...props }: any) => (
    <span style={style} {...props}>
      {children}
    </span>
  ),
  u: ({ children }: any) => <u>{children}</u>,
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
      return <YouTubeEmbed url={src} className="my-3 first:mt-0 last:mb-0" />;
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
