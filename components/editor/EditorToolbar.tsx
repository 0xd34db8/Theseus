"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { type Editor } from "@tiptap/react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  FileCode,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Table as TableIcon,
  Sigma,
  RemoveFormatting,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";

const FONT_SIZE_OPTIONS = [
  { value: "12", label: "12" },
  { value: "14", label: "14" },
  { value: "16", label: "16 (normal)" },
  { value: "18", label: "18" },
  { value: "20", label: "20" },
  { value: "24", label: "24" },
  { value: "32", label: "32" },
  { value: "48", label: "48" },
];

export interface EditorToolbarProps {
  editor: Editor | null;
  compact?: boolean;
  className?: string;
  showHistory?: boolean;
  showClearFormatting?: boolean;
  onSlideUp?: () => void;
}

export function EditorToolbar({
  editor,
  compact = false,
  className = "",
  showHistory = true,
  showClearFormatting = true,
  onSlideUp,
}: EditorToolbarProps) {
  const btnClass = (isActive: boolean, isDisabled: boolean = false) =>
    `${compact ? "p-1" : "p-1.5"} rounded transition-colors cursor-pointer ${
      isDisabled
        ? "text-muted-foreground/40 cursor-not-allowed"
        : isActive
          ? "bg-card text-foreground font-semibold shadow-2xs"
          : "text-foreground-subtle hover:bg-card hover:text-foreground"
    }`;

  const iconClass = compact ? "w-3 h-3" : "w-3.5 h-3.5";
  const dividerClass = compact
    ? "w-px h-3.5 bg-border mx-0.5 shrink-0"
    : "w-px h-4 bg-border mx-1 shrink-0";

  // Font & Item Size Combobox state
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("16 (normal)");
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);

  const updatePopoverCoords = useCallback(() => {
    if (comboboxRef.current) {
      const rect = comboboxRef.current.getBoundingClientRect();
      const popoverWidth = Math.max(rect.width, 116);
      const maxLeft =
        typeof window !== "undefined"
          ? window.innerWidth - popoverWidth - 8
          : rect.left;
      const left = Math.max(8, Math.min(rect.left, maxLeft));
      setPopoverCoords({
        top: rect.bottom + 4,
        left,
        width: popoverWidth,
      });
    }
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) updatePopoverCoords();
      return next;
    });
  }, [updatePopoverCoords]);

  // Compute active size for text or image
  const getActiveSize = useCallback(() => {
    if (!editor) return "16 (normal)";

    // 1. If an image is selected
    if (editor.isActive("image")) {
      const imageAttrs = editor.getAttributes("image");
      if (!imageAttrs.width) return "16 (normal)";
      const w =
        typeof imageAttrs.width === "number"
          ? imageAttrs.width
          : parseInt(String(imageAttrs.width), 10);
      if (isNaN(w)) return "16 (normal)";

      const parentEl =
        editor.view?.dom?.closest(".ProseMirror") || editor.view?.dom;
      const maxW = parentEl?.clientWidth || 700;
      const ratio = w / maxW;

      if (Math.abs(ratio - 0.25) < 0.05) return "12";
      if (Math.abs(ratio - 0.35) < 0.05) return "14";
      if (Math.abs(ratio - 0.5) < 0.05) return "18";
      if (Math.abs(ratio - 0.65) < 0.05) return "20";
      if (Math.abs(ratio - 0.75) < 0.05) return "24";
      if (Math.abs(ratio - 0.9) < 0.05) return "32";
      if (Math.abs(ratio - 1.0) < 0.05) return "48";
      return String(w);
    }

    // 2. Custom fontSize mark
    const customSize = editor.getAttributes("fontSize")?.size;
    if (customSize) {
      const parsed = parseInt(String(customSize), 10);
      if (!isNaN(parsed)) {
        return parsed === 16 ? "16 (normal)" : String(parsed);
      }
    }

    // 3. Heading levels
    if (editor.isActive("heading", { level: 1 })) return "32";
    if (editor.isActive("heading", { level: 2 })) return "24";
    if (editor.isActive("heading", { level: 3 })) return "20";
    if (editor.isActive("heading", { level: 4 })) return "18";
    if (editor.isActive("heading", { level: 5 })) return "16 (normal)";
    if (editor.isActive("heading", { level: 6 })) return "14";

    // 4. Computed style from selection anchor DOM node
    try {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const el =
          sel.anchorNode instanceof HTMLElement
            ? sel.anchorNode
            : sel.anchorNode.parentElement;
        if (el && editor.view?.dom?.contains(el)) {
          const computed = window.getComputedStyle(el).fontSize;
          if (computed) {
            const parsed = Math.round(parseFloat(computed));
            if (!isNaN(parsed) && parsed > 0) {
              return parsed === 16 ? "16 (normal)" : String(parsed);
            }
          }
        }
      }
    } catch {}

    return "16 (normal)";
  }, [editor]);

  // Keep input in sync with highlighted text or image
  useEffect(() => {
    if (!editor) return;

    const updateSize = () => {
      if (isTypingRef.current) return;
      setInputValue(getActiveSize());
    };

    updateSize();

    editor.on("selectionUpdate", updateSize);
    editor.on("transaction", updateSize);

    return () => {
      editor.off("selectionUpdate", updateSize);
      editor.off("transaction", updateSize);
    };
  }, [editor, getActiveSize]);

  // Dismissal and repositioning listeners for dropdown popover
  useEffect(() => {
    if (!isOpen) return;

    updatePopoverCoords();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        comboboxRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleScrollOrResize = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePopoverCoords]);

  const applySize = (rawVal: string) => {
    if (!editor) return;
    const clean = rawVal.replace(/\(normal\)/gi, "").trim();
    const num = parseInt(clean, 10);

    const isImg = editor.isActive("image");
    const { from, to } = editor.state.selection;
    let hasImg = false;
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name === "image") hasImg = true;
    });

    if (isImg || hasImg) {
      const parentEl =
        editor.view?.dom?.closest(".ProseMirror") || editor.view?.dom;
      const maxW = parentEl?.clientWidth || 700;

      let targetWidth: number | null = null;
      if (
        isNaN(num) ||
        clean.toLowerCase() === "normal" ||
        clean.toLowerCase() === "auto" ||
        num === 16
      ) {
        targetWidth = null; // resets to normal / natural
      } else if (num <= 48) {
        if (num <= 12) targetWidth = Math.round(maxW * 0.25);
        else if (num <= 14) targetWidth = Math.round(maxW * 0.35);
        else if (num <= 18) targetWidth = Math.round(maxW * 0.5);
        else if (num <= 20) targetWidth = Math.round(maxW * 0.65);
        else if (num <= 24) targetWidth = Math.round(maxW * 0.75);
        else if (num <= 32) targetWidth = Math.round(maxW * 0.9);
        else targetWidth = Math.round(maxW * 1.0);
      } else {
        targetWidth = Math.min(num, maxW);
      }

      if (isImg) {
        editor
          .chain()
          .focus()
          .updateAttributes("image", { width: targetWidth })
          .run();
      }

      if (hasImg && !isImg) {
        editor.state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "image") {
            editor.commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                width: targetWidth,
              });
              return true;
            });
          }
        });
      }
    }

    if (!isImg) {
      if (isNaN(num) || clean.toLowerCase() === "normal" || num === 16) {
        (editor.chain().focus() as any).unsetFontSize().run();
      } else {
        (editor.chain().focus() as any).setFontSize(`${num}px`).run();
      }
    }

    if (isNaN(num) || clean.toLowerCase() === "normal" || num === 16) {
      setInputValue("16 (normal)");
    } else {
      setInputValue(String(num));
    }
  };

  if (!editor) return null;

  return (
    <div
      className={`w-full flex items-center gap-1 bg-subtle text-foreground-subtle overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap ${
        compact
          ? "px-2 py-1.5 text-[11px]"
          : "px-3 sm:px-6 md:px-8 py-2 text-xs"
      } ${className}`}
    >
      {/* Undo / Redo */}
      {showHistory && (
        <>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className={btnClass(false, !editor.can().undo())}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className={iconClass} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={btnClass(false, !editor.can().redo())}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className={iconClass} />
          </button>
          <div className={dividerClass} />
        </>
      )}

      {/* Font & Item Size Combobox */}
      <div
        ref={comboboxRef}
        className={`relative flex items-center bg-card border border-border rounded text-foreground outline-hidden ${
          compact ? "text-[11px] h-6" : "text-xs h-7 rounded-md"
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={(e) => {
            isTypingRef.current = true;
            e.target.select();
          }}
          onBlur={() => {
            isTypingRef.current = false;
            applySize(inputValue);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              isTypingRef.current = false;
              applySize(inputValue);
              setIsOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              isTypingRef.current = false;
              setIsOpen(false);
              setInputValue(getActiveSize());
              inputRef.current?.blur();
            }
          }}
          placeholder="16"
          className="w-20 sm:w-22 px-1.5 py-0.5 text-center bg-transparent outline-none font-medium text-foreground select-all"
          title="Font & item size (type any number or select)"
          aria-label="Font and item size"
        />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={toggleOpen}
          className="h-full px-1.5 hover:bg-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-l border-border flex items-center justify-center rounded-r"
          title="Select size"
          aria-label="Select size preset"
        >
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Dropdown Popover via React Portal directly into document.body */}
        {isOpen &&
          popoverCoords &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={popoverRef}
              style={{
                position: "fixed",
                top: `${popoverCoords.top}px`,
                left: `${popoverCoords.left}px`,
                minWidth: `${popoverCoords.width}px`,
                zIndex: 9999,
              }}
              className="bg-card border border-border rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto font-manrope text-xs"
            >
              {FONT_SIZE_OPTIONS.map((opt) => {
                const cleanInput = inputValue.replace(/\(normal\)/gi, "").trim();
                const active =
                  cleanInput === opt.value ||
                  (opt.value === "16" && cleanInput === "16");
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => {
                      setIsOpen(false);
                      applySize(opt.value);
                    }}
                    className={`w-full text-left px-2.5 py-1 hover:bg-subtle transition-colors cursor-pointer flex items-center justify-between ${
                      active
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="w-3 h-3 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
      </div>

      <div className={dividerClass} />

      {/* Inline Marks: Bold, Italic, Underline, Strike, Highlight, Code */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
        title="Bold (Ctrl+B)"
      >
        <Bold className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
        title="Italic (Ctrl+I)"
      >
        <Italic className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive("underline"))}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive("strike"))}
        title="Strikethrough (Ctrl+Shift+S)"
      >
        <Strikethrough className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={btnClass(editor.isActive("highlight"))}
        title="Highlight marker"
      >
        <Highlighter className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btnClass(editor.isActive("code"))}
        title="Inline Code (Ctrl+E)"
      >
        <Code className={iconClass} />
      </button>

      <div className={dividerClass} />

      {/* Lists & Structural Elements */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        <List className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        <ListOrdered className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={btnClass(editor.isActive("taskList"))}
        title="Checklist / Todo (Ctrl+Shift+9)"
      >
        <CheckSquare className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive("blockquote"))}
        title="Quote block"
      >
        <Quote className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btnClass(editor.isActive("codeBlock"))}
        title="Code block"
      >
        <FileCode className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btnClass(false)}
        title="Horizontal Divider"
      >
        <Minus className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          (editor.chain().focus() as any)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        className={btnClass(editor.isActive("table"))}
        title="Insert Table (3x3)"
      >
        <TableIcon className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: "mathNode",
              attrs: { latex: "E = mc^2", display: "no" },
            })
            .run()
        }
        className={btnClass(editor.isActive("mathNode"))}
        title="Insert LaTeX Formula"
      >
        <Sigma className={iconClass} />
      </button>

      <div className={dividerClass} />

      {/* Alignment */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btnClass(editor.isActive({ textAlign: "left" }))}
        title="Align Left (Ctrl+Shift+L)"
      >
        <AlignLeft className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btnClass(editor.isActive({ textAlign: "center" }))}
        title="Align Center (Ctrl+Shift+E)"
      >
        <AlignCenter className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btnClass(editor.isActive({ textAlign: "right" }))}
        title="Align Right (Ctrl+Shift+R)"
      >
        <AlignRight className={iconClass} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={btnClass(editor.isActive({ textAlign: "justify" }))}
        title="Align Justify (Ctrl+Shift+J)"
      >
        <AlignJustify className={iconClass} />
      </button>

      {/* Clear Formatting */}
      {showClearFormatting && (
        <>
          <div className={dividerClass} />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
            className={btnClass(false)}
            title="Clear formatting"
          >
            <RemoveFormatting className={iconClass} />
          </button>
        </>
      )}

      {/* Slide Up Ribbon Button */}
      {onSlideUp && (
        <div className="ml-auto flex items-center pl-1 shrink-0">
          <div className={dividerClass} />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSlideUp}
            className={btnClass(false)}
            title="Hide ribbon"
            aria-label="Hide ribbon"
          >
            <ChevronUp className={iconClass} />
          </button>
        </div>
      )}
    </div>
  );
}
