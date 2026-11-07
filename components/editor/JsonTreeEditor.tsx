"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { SyllabusItem } from "@/types/syllabus";
import { Braces, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  serializeSyllabusToJson,
  tolerantParseSyllabus,
} from "@/lib/parser";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAndHighlight(str: string, search?: string): string {
  if (!search || !search.trim()) {
    return escapeHtml(str);
  }
  const clean = search.trim().toLowerCase();
  const lower = str.toLowerCase();
  let index = lower.indexOf(clean);
  if (index === -1) {
    return escapeHtml(str);
  }

  let result = "";
  let lastIndex = 0;
  while (index !== -1) {
    result += escapeHtml(str.slice(lastIndex, index));
    const matched = str.slice(index, index + clean.length);
    result += `<mark class="editor-search-match">${escapeHtml(matched)}</mark>`;
    lastIndex = index + clean.length;
    index = lower.indexOf(clean, lastIndex);
  }
  result += escapeHtml(str.slice(lastIndex));
  return result;
}

export function highlightJson(
  code: string,
  isValid: boolean,
  search?: string,
): string {
  if (!code) return "";
  if (!isValid) {
    return `<span class="text-red-500">${escapeAndHighlight(code, search)}</span>`;
  }

  const tokenRegex =
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g;

  let lastIndex = 0;
  let html = "";
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      html += escapeAndHighlight(code.slice(lastIndex, match.index), search);
    }
    const token = match[0];
    lastIndex = match.index + token.length;

    if (token.startsWith('"')) {
      if (token.endsWith(":")) {
        const colonIndex = token.lastIndexOf(":");
        const keyPart = token.slice(0, colonIndex);
        const colonPart = token.slice(colonIndex);
        html += `<span class="text-sky-600 dark:text-sky-400 font-semibold">${escapeAndHighlight(keyPart, search)}</span><span class="text-foreground-subtle">${escapeAndHighlight(colonPart, search)}</span>`;
      } else {
        html += `<span class="text-emerald-600 dark:text-emerald-400">${escapeAndHighlight(token, search)}</span>`;
      }
    } else if (/^(true|false|null)$/.test(token)) {
      html += `<span class="text-amber-600 dark:text-amber-400 font-medium">${escapeAndHighlight(token, search)}</span>`;
    } else if (/^-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?$/.test(token)) {
      html += `<span class="text-purple-600 dark:text-purple-400">${escapeAndHighlight(token, search)}</span>`;
    } else if (/[{}\[\]]/.test(token)) {
      html += `<span class="text-foreground font-bold">${escapeAndHighlight(token, search)}</span>`;
    } else if (token === ",") {
      html += `<span class="text-muted-foreground">${escapeAndHighlight(token, search)}</span>`;
    } else {
      html += escapeAndHighlight(token, search);
    }
  }

  if (lastIndex < code.length) {
    html += escapeAndHighlight(code.slice(lastIndex), search);
  }

  return html;
}

export interface JsonTreeEditorProps {
  items: SyllabusItem[];
  courseTitle?: string;
  onUpdateItems?: (items: SyllabusItem[]) => void;
  onUpdateTitle?: (title: string) => void;
  onClose: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

export function JsonTreeEditor({
  items,
  courseTitle,
  onUpdateItems,
  onUpdateTitle,
  onClose,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search topics...",
}: JsonTreeEditorProps) {
  const [jsonText, setJsonText] = useState(() =>
    serializeSyllabusToJson(items, courseTitle),
  );
  const [isValidJson, setIsValidJson] = useState(true);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const activeSearchQuery =
    searchQuery !== undefined ? searchQuery : internalSearchQuery;

  const handleSearchChange = (query: string) => {
    setInternalSearchQuery(query);
    onSearchChange?.(query);
    setActiveMatchIndex(0);
    setHasNavigated(false);
  };

  const matches = useMemo(() => {
    if (!activeSearchQuery || !activeSearchQuery.trim()) return [];
    const clean = activeSearchQuery.trim().toLowerCase();
    const lower = jsonText.toLowerCase();
    const indices: number[] = [];
    let idx = lower.indexOf(clean);
    while (idx !== -1) {
      indices.push(idx);
      idx = lower.indexOf(clean, idx + clean.length);
    }
    return indices;
  }, [jsonText, activeSearchQuery]);

  const scrollToMatch = (targetIndex: number) => {
    if (!textareaRef.current || matches.length === 0) return;
    const validIndex =
      targetIndex >= 0 && targetIndex < matches.length ? targetIndex : 0;

    const performScroll = () => {
      if (preRef.current) {
        const markElements = preRef.current.querySelectorAll(
          "mark.editor-search-match",
        );
        markElements.forEach((el, i) => {
          if (i === validIndex) {
            el.classList.add("editor-search-match-active");
          } else {
            el.classList.remove("editor-search-match-active");
          }
        });

        const activeMark = markElements[validIndex] as HTMLElement | undefined;
        if (activeMark && textareaRef.current) {
          const containerHeight = textareaRef.current.clientHeight || 300;
          const targetScroll = Math.max(
            0,
            activeMark.offsetTop - containerHeight / 2 + 10,
          );
          textareaRef.current.scrollTo({
            top: targetScroll,
            behavior: "smooth",
          });
          preRef.current.scrollTo({
            top: targetScroll,
            behavior: "smooth",
          });
          return;
        }
      }

      // Fallback calculation by line number if mark is not yet queryable
      const charPos = matches[validIndex] ?? 0;
      const textBefore = jsonText.substring(0, charPos);
      const lineNum = textBefore.split("\n").length;
      const lineHeight = 20;
      const targetScroll = Math.max(0, (lineNum - 4) * lineHeight);
      if (textareaRef.current) {
        textareaRef.current.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      }
      if (preRef.current) {
        preRef.current.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      }
    };

    setTimeout(performScroll, 20);
  };

  const handleFindNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(nextIdx);
    setHasNavigated(true);
    scrollToMatch(nextIdx);
  };

  const handleFindPrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(prevIdx);
    setHasNavigated(true);
    scrollToMatch(prevIdx);
  };

  // Sync scroll between textarea and syntax highlight pre overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setJsonText(newText);
    const res = tolerantParseSyllabus(newText, items);
    setIsValidJson(res.isValid);
    if (res.items && res.items.length > 0) {
      onUpdateItems?.(res.items);
    }
    if (res.courseTitle && onUpdateTitle) {
      onUpdateTitle(res.courseTitle.trim());
    }
  };

  const handleFormatJson = () => {
    const res = tolerantParseSyllabus(jsonText, items);
    if (res.items && res.items.length > 0) {
      const formatted = serializeSyllabusToJson(
        res.items,
        res.courseTitle || courseTitle,
      );
      setJsonText(formatted);
      setIsValidJson(true);
      onUpdateItems?.(res.items);
      if (res.courseTitle && onUpdateTitle) {
        onUpdateTitle(res.courseTitle.trim());
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      setJsonText(newValue);
      const res = tolerantParseSyllabus(newValue, items);
      setIsValidJson(res.isValid);
      if (res.items && res.items.length > 0) {
        onUpdateItems?.(res.items);
      }
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const value = textarea.value;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const currentLine = value.substring(lineStart, start);
      const match = currentLine.match(/^(\s+)/);
      const indent = match ? match[1] : "";
      const extraIndent = /[{\[]\s*$/.test(currentLine.trim()) ? "  " : "";
      const totalIndent = indent + extraIndent;

      if (totalIndent.length > 0) {
        e.preventDefault();
        const end = textarea.selectionEnd;
        const newValue =
          value.substring(0, start) + "\n" + totalIndent + value.substring(end);
        setJsonText(newValue);
        const res = tolerantParseSyllabus(newValue, items);
        setIsValidJson(res.isValid);
        if (res.items && res.items.length > 0) {
          onUpdateItems?.(res.items);
        }
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + 1 + totalIndent.length;
        }, 0);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-100 font-manrope">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border-subtle text-xs select-none bg-subtle gap-2">
        {/* Permanent Search Bar aligned to the left */}
        <div className="relative flex-1 max-w-[210px] flex items-center">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            data-tree-search-input="true"
            type="text"
            value={activeSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches.length === 0) return;
                if (!hasNavigated) {
                  setHasNavigated(true);
                  setActiveMatchIndex(0);
                  scrollToMatch(0);
                } else {
                  if (e.shiftKey) handleFindPrev();
                  else handleFindNext();
                }
              } else if (e.key === "Escape") {
                handleSearchChange("");
              }
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-7 pr-6 py-1 text-xs bg-card border border-border rounded-full outline-hidden focus:border-accent font-manrope text-foreground placeholder-muted-foreground transition-all shadow-2xs"
          />
          {activeSearchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-subtle cursor-pointer transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Action buttons on the right */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeSearchQuery && activeSearchQuery.trim() && (
            <div className="flex items-center gap-0.5 mr-1">
              <span className="text-[10px] text-muted-foreground font-mono select-none px-1">
                {matches.length > 0
                  ? `${activeMatchIndex + 1}/${matches.length}`
                  : "0/0"}
              </span>
              {matches.length > 1 && (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={handleFindPrev}
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded-sm hover:bg-card cursor-pointer"
                    title="Previous match (Shift+Enter)"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleFindNext}
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded-sm hover:bg-card cursor-pointer"
                    title="Next match (Enter)"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleFormatJson}
            className="px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-card rounded-sm transition-colors cursor-pointer"
            title="Format JSON indentation"
          >
            Format
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-[11px] transition-colors cursor-pointer shadow-2xs"
            title="Return to Tree view (Esc or Ctrl+Enter)"
          >
            <Braces className="w-3.5 h-3.5" />
            <span>Parse</span>
          </button>
        </div>
      </div>

      {/* Formatted live editor */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-card">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none m-0 p-3.5 font-mono text-xs leading-[20px] whitespace-pre-wrap wrap-break-word overflow-hidden tab-2"
          dangerouslySetInnerHTML={{
            __html:
              highlightJson(jsonText, isValidJson, activeSearchQuery) +
              (jsonText.endsWith("\n") ? " " : ""),
          }}
        />
        <textarea
          ref={textareaRef}
          value={jsonText}
          onChange={handleJsonChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder="Edit syllabus tree JSON here..."
          spellCheck={false}
          className={`relative w-full h-full m-0 p-3.5 font-mono text-xs leading-[20px] whitespace-pre-wrap wrap-break-word bg-transparent outline-hidden resize-none overflow-y-auto text-transparent selection:text-transparent tab-2 ${
            isValidJson
              ? "caret-foreground selection:bg-accent-subtle"
              : "caret-red-500 selection:bg-red-500/20"
          }`}
        />
      </div>
    </div>
  );
}
