export interface ParsedYouTubeUrl {
  videoId: string;
  embedUrl: string;
  canonicalUrl: string;
  startSeconds?: number;
}

export type MediaAlign = "left" | "center" | "right";

export interface YouTubeEmbedMeta {
  width?: number | null;
  align?: MediaAlign;
}

export function normalizeMediaAlign(raw?: string | null): MediaAlign {
  if (raw === "center" || raw === "right") return raw;
  return "left";
}

export function parseMediaWidth(raw?: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === "string") {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function parseYouTubeEmbedMeta(meta?: string | null): YouTubeEmbedMeta {
  if (!meta) return {};
  const result: YouTubeEmbedMeta = {};
  for (const part of meta.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim().toLowerCase();
    const val = part.slice(eqIndex + 1).trim();
    if (!val) continue;
    if (key === "width") {
      const width = parseMediaWidth(val);
      if (width) result.width = width;
    } else if (key === "align") {
      const align = normalizeMediaAlign(val);
      if (align !== "left") result.align = align;
    }
  }
  return result;
}

export function formatYouTubeEmbedMeta(
  width?: number | null,
  align?: string | null,
): string {
  const parts: string[] = [];
  const validWidth = parseMediaWidth(width);
  if (validWidth) {
    parts.push(`width=${validWidth}`);
  }
  if (align === "center" || align === "right") {
    parts.push(`align=${align}`);
  }
  return parts.join(";");
}

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function parseTimestampSeconds(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const val = parseInt(trimmed, 10);
    return val > 0 ? val : undefined;
  }

  const hmsMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!hmsMatch || (!hmsMatch[1] && !hmsMatch[2] && !hmsMatch[3])) {
    return undefined;
  }

  const hours = hmsMatch[1] ? parseInt(hmsMatch[1], 10) : 0;
  const minutes = hmsMatch[2] ? parseInt(hmsMatch[2], 10) : 0;
  const seconds = hmsMatch[3] ? parseInt(hmsMatch[3], 10) : 0;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
}

/**
 * Parses a YouTube video URL (watch, youtu.be, shorts, live, embed) into embed details.
 * Returns null for non-video YouTube URLs (channels, playlists without video, search) or invalid URLs.
 */
export function parseYouTubeUrl(rawUrl: string): ParsedYouTubeUrl | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    videoId = segments[0] || null;
  } else if (url.pathname === "/watch" || url.pathname === "/watch/") {
    videoId = url.searchParams.get("v");
  } else if (
    segments.length >= 2 &&
    (segments[0] === "embed" ||
      segments[0] === "shorts" ||
      segments[0] === "live" ||
      segments[0] === "v")
  ) {
    videoId = segments[1];
  }

  if (!videoId || !YOUTUBE_ID_REGEX.test(videoId)) {
    return null;
  }

  const startSeconds = parseTimestampSeconds(
    url.searchParams.get("t") || url.searchParams.get("start"),
  );

  const embedUrl = startSeconds
    ? `https://www.youtube.com/embed/${videoId}?start=${startSeconds}`
    : `https://www.youtube.com/embed/${videoId}`;

  return {
    videoId,
    embedUrl,
    canonicalUrl: trimmed,
    startSeconds,
  };
}

/**
 * Extracts a standalone YouTube URL or pasted YouTube iframe embed snippet from clipboard text.
 */
export function extractYouTubeUrlFromPaste(
  rawText: string,
): ParsedYouTubeUrl | null {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const direct = parseYouTubeUrl(trimmed);
  if (direct) return direct;

  const iframeMatch = trimmed.match(
    /^<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/iframe>$/i,
  );
  if (iframeMatch?.[1]) {
    return parseYouTubeUrl(iframeMatch[1]);
  }

  return null;
}
