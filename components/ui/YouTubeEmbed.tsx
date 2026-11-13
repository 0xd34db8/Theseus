"use client";

import React from "react";
import { parseYouTubeUrl } from "@/lib/youtube";

interface YouTubeEmbedProps {
  url: string;
  className?: string;
  header?: React.ReactNode;
}

/**
 * Responsive 16:9 YouTube video embed container shared by MarkdownRenderer and TipTap editor nodes.
 */
export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  url,
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

  return (
    <div
      className={`w-full max-w-2xl rounded-xl border border-border bg-card overflow-hidden ${className}`}
    >
      {header}
      <div className="relative w-full aspect-video bg-subtle">
        <iframe
          src={parsed.embedUrl}
          title="YouTube video player"
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
};
