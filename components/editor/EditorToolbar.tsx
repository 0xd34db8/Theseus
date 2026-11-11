"use client";

import React from "react";
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
} from "lucide-react";

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
  if (!editor) return null;

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

  // Item / Font Size calculation
  const isImageActive = editor.isActive("image");
  const currentImageAttrs = isImageActive
    ? editor.getAttributes("image")
    : null;

  let currentImagePreset = "auto";
  if (isImageActive && currentImageAttrs?.width) {
    const parentEl =
      editor.view?.dom?.closest(".ProseMirror") || editor.view?.dom;
    const maxW = parentEl?.clientWidth || 700;
    const numericWidth =
      typeof currentImageAttrs.width === "number"
        ? currentImageAttrs.width
        : parseInt(String(currentImageAttrs.width), 10);
    if (!isNaN(numericWidth)) {
      const ratio = numericWidth / maxW;
      if (ratio <= 0.35) currentImagePreset = "25%";
      else if (ratio <= 0.6) currentImagePreset = "50%";
      else if (ratio <= 0.85) currentImagePreset = "75%";
      else currentImagePreset = "100%";
    }
  }

  const currentFontSize =
    editor.getAttributes("fontSize")?.size || "default";
  const currentSizeValue = isImageActive
    ? currentImagePreset
    : currentFontSize;

  const handleSizeChange = (val: string) => {
    const { from, to } = editor.state.selection;
    let hasImageInSelection = false;
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name === "image") {
        hasImageInSelection = true;
      }
    });

    if (isImageActive || hasImageInSelection) {
      const parentEl =
        editor.view?.dom?.closest(".ProseMirror") || editor.view?.dom;
      const maxW = parentEl?.clientWidth || 700;

      let targetWidth: number | null = null;
      if (val === "25%" || val === "12px") {
        targetWidth = Math.round(maxW * 0.25);
      } else if (val === "35%" || val === "14px") {
        targetWidth = Math.round(maxW * 0.35);
      } else if (val === "50%" || val === "16px") {
        targetWidth = Math.round(maxW * 0.5);
      } else if (val === "60%" || val === "18px") {
        targetWidth = Math.round(maxW * 0.6);
      } else if (val === "70%" || val === "20px") {
        targetWidth = Math.round(maxW * 0.7);
      } else if (val === "75%" || val === "24px") {
        targetWidth = Math.round(maxW * 0.75);
      } else if (val === "90%" || val === "32px") {
        targetWidth = Math.round(maxW * 0.9);
      } else if (val === "100%" || val === "48px") {
        targetWidth = Math.round(maxW * 1.0);
      } else if (val === "auto" || val === "default") {
        targetWidth = null;
      } else {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) {
          targetWidth = val.endsWith("%")
            ? Math.round(maxW * (parsed / 100))
            : parsed;
        }
      }

      if (isImageActive) {
        editor
          .chain()
          .focus()
          .updateAttributes("image", { width: targetWidth })
          .run();
      }

      if (hasImageInSelection && !isImageActive) {
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

    if (!isImageActive) {
      if (val === "default" || val === "auto") {
        (editor.chain().focus() as any).unsetFontSize().run();
      } else {
        const fontSizeToApply =
          val === "25%"
            ? "12px"
            : val === "50%"
              ? "16px"
              : val === "75%"
                ? "24px"
                : val === "100%"
                  ? "48px"
                  : val;
        (editor.chain().focus() as any).setFontSize(fontSizeToApply).run();
      }
    }
  };

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

      {/* Style selector */}
      <select
        value={
          editor.isActive("heading", { level: 1 })
            ? "1"
            : editor.isActive("heading", { level: 2 })
              ? "2"
              : editor.isActive("heading", { level: 3 })
                ? "3"
                : editor.isActive("heading", { level: 4 })
                  ? "4"
                  : editor.isActive("heading", { level: 5 })
                    ? "5"
                    : editor.isActive("heading", { level: 6 })
                      ? "6"
                      : "p"
        }
        onChange={(e) => {
          const val = e.target.value;
          if (val === "p") {
            editor.chain().focus().setParagraph().run();
          } else {
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: parseInt(val, 10) as 1 | 2 | 3 | 4 | 5 | 6,
              })
              .run();
          }
        }}
        className={`bg-card border border-border rounded text-foreground outline-hidden cursor-pointer font-medium hover:border-border ${
          compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-1 rounded-md"
        }`}
        title="Text style"
      >
        <option value="p">Normal text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="4">Heading 4</option>
        <option value="5">Heading 5</option>
        <option value="6">Heading 6</option>
      </select>

      {/* Font Size & Item Size Selector */}
      <select
        value={currentSizeValue}
        onChange={(e) => handleSizeChange(e.target.value)}
        className={`bg-card border border-border rounded text-foreground outline-hidden cursor-pointer font-medium hover:border-border ${
          compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-1 rounded-md"
        }`}
        title={isImageActive ? "Image size" : "Font size"}
      >
        {isImageActive ? (
          <>
            <option value="auto">Image: Auto</option>
            <option value="25%">Image: 25% (Small)</option>
            <option value="50%">Image: 50% (Medium)</option>
            <option value="75%">Image: 75% (Large)</option>
            <option value="100%">Image: 100% (Full)</option>
          </>
        ) : (
          <>
            <option value="default">Font size</option>
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="16px">16px (Normal)</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
            <option value="24px">24px (Large)</option>
            <option value="32px">32px (XL)</option>
            <option value="48px">48px (Huge)</option>
          </>
        )}
      </select>

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
