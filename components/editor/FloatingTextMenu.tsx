"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { type Editor } from "@tiptap/react";
import {
  Type,
  ChevronRight,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link,
  Strikethrough,
  Code,
  MoreHorizontal,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Check,
  Superscript as SuperscriptIcon,
  Copy,
  ArrowLeft,
} from "lucide-react";

export interface FloatingTextMenuProps {
  editor: Editor | null;
  isReadingMode?: boolean;
}

interface MenuPosition {
  placement: "top" | "bottom";
  left: number;
  top?: number;
  bottom?: number;
}

function SqrtXIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "w-3.5 h-3.5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 13h2.5l2.5 8 4-17h9" />
      <path d="M14 11l4 6" />
      <path d="M18 11l-4 6" />
    </svg>
  );
}

function ClearFormattingIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline font-serif leading-none select-none ${
        className || ""
      }`}
    >
      <span className="text-xs font-semibold">T</span>
      <span className="text-[9px] -ml-0.5 font-normal">x</span>
    </span>
  );
}

const TURN_INTO_OPTIONS = [
  {
    label: "Normal Text",
    icon: Type,
    isActive: (ed: Editor) =>
      !ed.isActive("heading") &&
      !ed.isActive("bulletList") &&
      !ed.isActive("orderedList") &&
      !ed.isActive("blockquote") &&
      !ed.isActive("codeBlock"),
    action: (ed: Editor) => ed.chain().focus().setParagraph().run(),
  },
  {
    label: "Heading 1",
    icon: Heading1,
    isActive: (ed: Editor) => ed.isActive("heading", { level: 1 }),
    action: (ed: Editor) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    icon: Heading2,
    isActive: (ed: Editor) => ed.isActive("heading", { level: 2 }),
    action: (ed: Editor) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    icon: Heading3,
    isActive: (ed: Editor) => ed.isActive("heading", { level: 3 }),
    action: (ed: Editor) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bulleted List",
    icon: List,
    isActive: (ed: Editor) => ed.isActive("bulletList"),
    action: (ed: Editor) => ed.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered List",
    icon: ListOrdered,
    isActive: (ed: Editor) => ed.isActive("orderedList"),
    action: (ed: Editor) => ed.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Quote",
    icon: Quote,
    isActive: (ed: Editor) => ed.isActive("blockquote"),
    action: (ed: Editor) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "Code Block",
    icon: Code2,
    isActive: (ed: Editor) => ed.isActive("codeBlock"),
    action: (ed: Editor) => ed.chain().focus().toggleCodeBlock().run(),
  },
];

export const FloatingTextMenu: React.FC<FloatingTextMenuProps> = ({
  editor,
  isReadingMode = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [isTurnIntoOpen, setIsTurnIntoOpen] = useState(false);
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const getBlockType = useCallback(() => {
    if (!editor) return { label: "Normal Text", icon: Type };
    if (editor.isActive("heading", { level: 1 }))
      return { label: "Heading 1", icon: Heading1 };
    if (editor.isActive("heading", { level: 2 }))
      return { label: "Heading 2", icon: Heading2 };
    if (editor.isActive("heading", { level: 3 }))
      return { label: "Heading 3", icon: Heading3 };
    if (editor.isActive("bulletList"))
      return { label: "Bulleted List", icon: List };
    if (editor.isActive("orderedList"))
      return { label: "Numbered List", icon: ListOrdered };
    if (editor.isActive("blockquote")) return { label: "Quote", icon: Quote };
    if (editor.isActive("codeBlock"))
      return { label: "Code Block", icon: Code2 };
    return { label: "Normal Text", icon: Type };
  }, [editor]);

  // Position calculation anchored to selection coordinates
  const updatePosition = useCallback(() => {
    if (!editor || !editor.isEditable || isReadingMode) {
      setIsVisible(false);
      return;
    }

    const { from, to, empty } = editor.state.selection;
    if (empty || from === to) {
      setIsVisible(false);
      setIsTurnIntoOpen(false);
      setIsLinkInputOpen(false);
      setIsMoreOpen(false);
      return;
    }

    // Do not show on image or YouTube embed selection
    if (editor.isActive("image") || editor.isActive("youtube")) {
      setIsVisible(false);
      return;
    }

    const domSel = window.getSelection();
    if (!domSel || domSel.isCollapsed || domSel.rangeCount === 0) {
      setIsVisible(false);
      return;
    }

    const range = domSel.getRangeAt(0);
    const editorDom = editor.view?.dom;
    if (!editorDom || !editorDom.contains(range.commonAncestorContainer)) {
      setIsVisible(false);
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) {
      setIsVisible(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setIsVisible(false);
      return;
    }

    const menuWidth = 240;
    const BASE_MENU_HEIGHT = 100;
    const padding = 12;

    let left = rect.left + rect.width / 2 - menuWidth / 2;
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - menuWidth - padding),
    );

    // Anchor calculation:
    // By default, appear BELOW the highlighted text (anchored by CSS `top` at rect.bottom + 8).
    // Only flip above if there is no room below the text at the very bottom edge of the viewport.
    const fitsBelow = window.innerHeight - rect.bottom >= BASE_MENU_HEIGHT + 16;

    if (fitsBelow) {
      setMenuPosition({
        placement: "bottom",
        left,
        top: Math.round(rect.bottom + 8),
      });
    } else {
      setMenuPosition({
        placement: "top",
        left,
        bottom: Math.round(window.innerHeight - rect.top + 8),
      });
    }

    setIsVisible(true);
  }, [editor, isReadingMode]);

  // Keep menu in sync with selection updates, scroll, and resize
  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      requestAnimationFrame(updatePosition);
    };

    const handleMouseUp = () => {
      setTimeout(updatePosition, 10);
    };

    const handleScrollOrResize = () => {
      if (isVisible) {
        requestAnimationFrame(updatePosition);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isTurnIntoOpen || isLinkInputOpen || isMoreOpen) {
          setIsTurnIntoOpen(false);
          setIsLinkInputOpen(false);
          setIsMoreOpen(false);
        } else {
          setIsVisible(false);
        }
      }
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      setTimeout(() => {
        if (!editor || editor.state.selection.empty) {
          setIsVisible(false);
          setIsTurnIntoOpen(false);
          setIsLinkInputOpen(false);
          setIsMoreOpen(false);
        }
      }, 50);
    };

    editor.on("selectionUpdate", onUpdate);
    editor.on("transaction", onUpdate);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDownOutside);

    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("transaction", onUpdate);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [editor, isVisible, updatePosition, isTurnIntoOpen, isLinkInputOpen, isMoreOpen]);

  if (!editor || !isVisible || !menuPosition || typeof document === "undefined") {
    return null;
  }

  const blockType = getBlockType();
  const BlockIcon = blockType.icon;

  const btnClass = (isActive: boolean) =>
    `w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-xs ${
      isActive
        ? "bg-accent-subtle text-accent font-semibold"
        : "text-foreground-subtle hover:text-foreground hover:bg-subtle"
    }`;

  const handleApplyLink = () => {
    if (!editor) return;
    const cleanUrl = linkUrl.trim();
    if (cleanUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: cleanUrl })
        .run();
    }
    setIsLinkInputOpen(false);
    setLinkUrl("");
  };

  const stylePosition: React.CSSProperties = {
    position: "fixed",
    left: `${menuPosition.left}px`,
    ...(menuPosition.placement === "top"
      ? { bottom: `${menuPosition.bottom}px` }
      : { top: `${menuPosition.top}px` }),
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={menuRef}
      style={stylePosition}
      className="w-60 bg-card border border-border rounded-2xl p-1.5 text-xs text-foreground font-manrope animate-in fade-in zoom-in-95 duration-100 select-none shadow-none"
    >
      {/* View 1: More Options with Back Button */}
      {isMoreOpen ? (
        <div className="py-0.5">
          <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-border-subtle px-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsMoreOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-subtle transition-colors font-medium"
              title="Back to formatting tools"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-1">
              More Options
            </span>
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                (editor.chain().focus() as any).toggleSuperscript().run();
                setIsMoreOpen(false);
              }}
              className={`w-full px-2 py-1.5 text-left flex items-center justify-between rounded-md cursor-pointer transition-colors ${
                editor.isActive("superscript")
                  ? "bg-accent-subtle text-accent font-medium"
                  : "text-foreground-subtle hover:text-foreground hover:bg-subtle"
              }`}
            >
              <div className="flex items-center gap-2">
                <SuperscriptIcon className="w-3.5 h-3.5" />
                <span>Superscript</span>
              </div>
              {editor.isActive("superscript") && (
                <Check className="w-3 h-3 text-accent shrink-0" />
              )}
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const { from, to } = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, " ");
                if (text && typeof navigator !== "undefined") {
                  navigator.clipboard?.writeText(text);
                }
                setIsMoreOpen(false);
              }}
              className="w-full px-2 py-1.5 text-left flex items-center gap-2 text-foreground-subtle hover:text-foreground hover:bg-subtle rounded-md cursor-pointer transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Text</span>
            </button>
          </div>
        </div>
      ) : isLinkInputOpen ? (
        /* View 2: Insert Link with Back Button */
        <div className="py-0.5">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border-subtle px-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsLinkInputOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-subtle transition-colors font-medium"
              title="Back to formatting tools"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-1">
              Insert Link
            </span>
          </div>

          <div className="px-1 flex items-center gap-1.5">
            <input
              type="url"
              autoFocus
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyLink();
                } else if (e.key === "Escape") {
                  setIsLinkInputOpen(false);
                }
              }}
              className="flex-1 min-w-0 bg-subtle border border-border rounded px-2 py-1 text-xs text-foreground outline-none font-manrope"
            />
            <button
              type="button"
              onClick={handleApplyLink}
              className="px-2 py-1 rounded bg-primary text-primary-foreground font-medium text-[11px] cursor-pointer hover:bg-primary-hover shrink-0"
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        /* View 3: Main Notion-Style Context Menu */
        <>
          {/* Row 1: Block Type / "Turn into" Dropdown Trigger */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsTurnIntoOpen(!isTurnIntoOpen)}
            className="w-full px-2 py-1 flex items-center justify-between rounded-lg hover:bg-subtle text-xs font-medium cursor-pointer transition-colors text-foreground"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BlockIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{blockType.label}</span>
            </div>
            <ChevronRight
              className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-150 ${
                isTurnIntoOpen ? "rotate-90" : ""
              }`}
            />
          </button>

          {/* Submenu: Turn into Options */}
          {isTurnIntoOpen ? (
            <div className="py-1 border-t border-border-subtle my-1 space-y-0.5 max-h-52 overflow-y-auto no-scrollbar">
              <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Turn into
              </div>
              {TURN_INTO_OPTIONS.map((opt) => {
                const isCurrent = opt.isActive(editor);
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      opt.action(editor);
                      setIsTurnIntoOpen(false);
                    }}
                    className={`w-full px-2 py-1 text-left flex items-center justify-between rounded-md cursor-pointer transition-colors ${
                      isCurrent
                        ? "bg-accent-subtle text-accent font-medium"
                        : "text-foreground-subtle hover:text-foreground hover:bg-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <OptIcon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </div>
                    {isCurrent && (
                      <Check className="w-3 h-3 text-accent shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="my-1 border-t border-border-subtle" />

              {/* Row 2: Highlight, Bold, Italic, Underline, Clear Formatting */}
              <div className="flex items-center justify-between px-1 py-0.5">
                {/* A: Highlight */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                  className={btnClass(editor.isActive("highlight"))}
                  title="Highlight text"
                >
                  <span className="w-4 h-4 flex items-center justify-center font-bold text-[11px] rounded border border-current">
                    A
                  </span>
                </button>

                {/* B: Bold */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={btnClass(editor.isActive("bold"))}
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                {/* I: Italic */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={btnClass(editor.isActive("italic"))}
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>

                {/* U: Underline */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    (editor.chain().focus() as any).toggleUnderline().run()
                  }
                  className={btnClass(editor.isActive("underline"))}
                  title="Underline (Ctrl+U)"
                >
                  <UnderlineIcon className="w-3.5 h-3.5" />
                </button>

                {/* Tx: Clear formatting */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    editor.chain().focus().unsetAllMarks().clearNodes().run()
                  }
                  className={btnClass(false)}
                  title="Clear formatting"
                >
                  <ClearFormattingIcon />
                </button>
              </div>

              {/* Row 3: Link, Strikethrough, Code, Math Formula, More */}
              <div className="flex items-center justify-between px-1 py-0.5">
                {/* Link */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (editor.isActive("link")) {
                      editor.chain().focus().unsetLink().run();
                    } else {
                      setLinkUrl(editor.getAttributes("link").href || "");
                      setIsLinkInputOpen(true);
                      setIsTurnIntoOpen(false);
                      setIsMoreOpen(false);
                    }
                  }}
                  className={btnClass(editor.isActive("link"))}
                  title="Link"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>

                {/* S: Strikethrough */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={btnClass(editor.isActive("strike"))}
                  title="Strikethrough"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>

                {/* </>: Code */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  className={btnClass(editor.isActive("code"))}
                  title="Inline Code (Ctrl+E)"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>

                {/* √x: Math Formula */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const { from, to } = editor.state.selection;
                    const text =
                      editor.state.doc.textBetween(from, to, " ") || "x";
                    editor
                      .chain()
                      .focus()
                      .insertContent({
                        type: "mathNode",
                        attrs: { latex: text.trim() || "x", display: "no" },
                      })
                      .run();
                  }}
                  className={btnClass(editor.isActive("mathNode"))}
                  title="LaTeX Math Formula"
                >
                  <SqrtXIcon className="w-3.5 h-3.5" />
                </button>

                {/* ···: More Options */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setIsMoreOpen(true);
                    setIsTurnIntoOpen(false);
                    setIsLinkInputOpen(false);
                  }}
                  className={btnClass(isMoreOpen)}
                  title="More formatting"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>,
    document.body,
  );
};
