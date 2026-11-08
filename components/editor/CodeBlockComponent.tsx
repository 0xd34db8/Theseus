"use client";

import React, { useState, useMemo, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { Copy, Check } from "lucide-react";
import { lowlight, LANGUAGE_LABELS } from "./lowlight";

interface CodeBlockComponentProps {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
}

export function CodeBlockComponent({
  node,
  updateAttributes,
}: CodeBlockComponentProps) {
  const [copied, setCopied] = useState(false);
  const rawLang = (node.attrs.language || "").trim().toLowerCase();

  // Infer language if not explicitly provided
  const detectedLang = useMemo(() => {
    if (rawLang) return rawLang;
    const text = node.textContent;
    if (!text || text.trim().length < 5) return "plaintext";
    try {
      const auto = lowlight.highlightAuto(text);
      return auto.data?.language || "plaintext";
    } catch {
      return "plaintext";
    }
  }, [rawLang, node.textContent]);

  const activeLang = rawLang || detectedLang;
  const badgeLabel =
    LANGUAGE_LABELS[activeLang] ||
    (activeLang ? activeLang.toUpperCase() : "CODE");

  const handleCopy = useCallback(async () => {
    try {
      const textToCopy = node.textContent || "";
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code block content:", err);
    }
  }, [node.textContent]);

  return (
    <NodeViewWrapper className="theseus-code-block-wrapper relative my-5 rounded-xl border border-border bg-[#0d1117] dark:bg-[#090d16] text-[#e6edf3] overflow-hidden shadow-xs group font-sans">
      {/* Code Block Header Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#161b22] dark:bg-[#0d131f] border-b border-border-subtle text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-2 py-0.5 rounded bg-black/30 border border-white/5">
            {badgeLabel}
          </span>
          {!rawLang && detectedLang && detectedLang !== "plaintext" && (
            <span className="text-[10px] text-muted-foreground/75 font-sans">
              (auto-detected)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-foreground-subtle hover:text-foreground hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-[11px]">
                Copied
              </span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Editor Surface */}
      <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed selection:bg-accent/30 selection:text-white">
        <NodeViewContent
          as={"code" as any}
          className={activeLang ? `language-${activeLang}` : ""}
        />
      </pre>
    </NodeViewWrapper>
  );
}
