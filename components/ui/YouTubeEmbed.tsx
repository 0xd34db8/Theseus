"use client";

import React from "react";
import {
  MediaAlign,
  normalizeMediaAlign,
  parseMediaWidth,
  parseYouTubeUrl,
} from "@/lib/youtube";

interface YouTubeEmbedProps {
  url: string;
  width?: number | string | null;
  align?: MediaAlign | string | null;
  fullWidth?: boolean;
  disableIframePointerEvents?: boolean;
  className?: string;
  header?: React.ReactNode;
}

/**
 * Responsive 16:9 YouTube video embed container shared by MarkdownRenderer and TipTap editor nodes.
 */
export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  url,
  width,
  align,
  fullWidth = false,
  disableIframePointerEvents = false,
  className = "",
  header,
}) => {
  const parsed = parseYouTubeUrl(url);

  if (!parsed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline underline-offset-2 transition-colors font-manrope wrap-anywhere"
      >
        {url}
      </a>
    );
  }

  const resolvedWidth = parseMediaWidth(width);
  const resolvedAlign = normalizeMediaAlign(align);
  const justifyClass =
    resolvedAlign === "center"
      ? "justify-center"
      : resolvedAlign === "right"
        ? "justify-end"
        : "justify-start";

  const card = (
    <div
      style={
        !fullWidth && resolvedWidth
          ? { width: `${resolvedWidth}px`, maxWidth: "100%" }
          : undefined
      }
      className={`${
        fullWidth
          ? "w-full"
          : resolvedWidth
            ? "w-full"
            : "w-full max-w-2xl"
      } rounded-xl border border-border bg-card overflow-hidden ${
        fullWidth ? className : ""
      }`}
    >
      {header}
      <div className="relative w-full aspect-video bg-subtle">
        <iframe
          src={parsed.embedUrl}
          title="YouTube video player"
          className={`absolute inset-0 w-full h-full border-0 ${
            disableIframePointerEvents ? "pointer-events-none" : ""
          }`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );

  if (fullWidth) {
    return card;
  }

  return <div className={`w-full flex ${justifyClass} ${className}`}>{card}</div>;
};
