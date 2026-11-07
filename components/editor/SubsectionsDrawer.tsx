"use client";

import React, { useState, useEffect, useRef } from "react";
import { SyllabusItem, TopicNote, NoteComment } from "@/types/syllabus";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Extension } from "@tiptap/core";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  CustomUnderline,
  CustomHighlight,
  getEditorMarkdown,
} from "./extensions";
import { EditorToolbar } from "./EditorToolbar";

interface SubsectionsDrawerProps {
  selectedTopic: SyllabusItem;
  onSaveNote: (topicId: string, note: TopicNote) => void;
  apiKey?: string;
  onOpenApiKeyModal?: () => void;
  onClose: () => void;
}

export const SubsectionsDrawer: React.FC<SubsectionsDrawerProps> = ({
  selectedTopic,
  onSaveNote,
  onClose,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const subComments: NoteComment[] = selectedTopic.note?.subComments || [];

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on Click Outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        const target = e.target as HTMLElement | null;
        if (target?.closest("[data-subsections-trigger]")) {
          return;
        }
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const handleSaveSubComment = () => {
    if (!editor) return;
    const content = getEditorMarkdown(editor).trim();
    if (!content) return;

    let updatedSubComments: NoteComment[];

    if (editingCommentId) {
      updatedSubComments = subComments.map((c) =>
        c.id === editingCommentId
          ? {
              ...c,
              content,
            }
          : c,
      );
    } else {
      const newComment: NoteComment = {
        id: `comment-${Date.now()}`,
        author: "",
        timestamp:
          new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }) +
          " at " +
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        content,
      };
      updatedSubComments = [...subComments, newComment];
    }

    const updatedNote: TopicNote = {
      id: selectedTopic.note?.id || `note-${selectedTopic.id}`,
      title: selectedTopic.title,
      content: selectedTopic.note?.content || "",
      subComments: updatedSubComments,
      updatedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    onSaveNote(selectedTopic.id, updatedNote);
    editor.commands.setContent("");
    setEditingCommentId(null);
    setIsAdding(false);
  };

  const handleSaveSubCommentRef = useRef(handleSaveSubComment);
  handleSaveSubCommentRef.current = handleSaveSubComment;

  // Live TipTap Markdown Editor for Sub-sections
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomUnderline,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CustomHighlight.configure({
        multicolor: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder:
          "Write sub-section notes (# for heading, - for list, [ ] for todo)...",
      }),
      Extension.create({
        name: "subSectionSubmitShortcut",
        addKeyboardShortcuts() {
          return {
            "Mod-Enter": () => {
              handleSaveSubCommentRef.current();
              return true;
            },
          };
        },
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
      }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose max-w-none focus:outline-hidden min-h-[90px] max-h-[160px] overflow-y-auto text-xs leading-relaxed text-foreground px-3 py-2 font-manrope cursor-text",
      },
    },
  });

  // Reset composer state if topic changes
  useEffect(() => {
    setEditingCommentId(null);
    setIsAdding(false);
    if (editor) {
      editor.commands.setContent("");
    }
  }, [selectedTopic.id, editor]);

  const handleStartEdit = (comment: NoteComment) => {
    setEditingCommentId(comment.id);
    setIsAdding(true);
    if (editor) {
      editor.commands.setContent(comment.content || "");
      setTimeout(() => {
        editor.commands.focus("end");
      }, 50);
    }
  };

  const handleOpenAddForm = () => {
    setEditingCommentId(null);
    setIsAdding(true);
    if (editor) {
      editor.commands.setContent("");
      setTimeout(() => {
        editor.commands.focus();
      }, 50);
    }
  };

  const handleCloseAddForm = () => {
    if (editor) {
      editor.commands.setContent("");
    }
    setEditingCommentId(null);
    setIsAdding(false);
  };

  const handleDeleteSubComment = (commentId: string) => {
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      if (editor) {
        editor.commands.setContent("");
      }
      setIsAdding(false);
    }
    const updatedSubComments = subComments.filter((c) => c.id !== commentId);
    const updatedNote: TopicNote = {
      id: selectedTopic.note?.id || `note-${selectedTopic.id}`,
      title: selectedTopic.title,
      content: selectedTopic.note?.content || "",
      subComments: updatedSubComments,
      updatedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    onSaveNote(selectedTopic.id, updatedNote);
  };

  return (
    <div
      ref={popoverRef}
      className="fixed bottom-14 right-4 sm:right-6 w-[380px] sm:w-[460px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[75vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200 font-manrope"
    >
      {/* Scrollable Subsections Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-subtle">
        {subComments.length === 0 && !isAdding && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none">
            <p className="text-xs font-medium text-foreground mb-1">
              No sub-sections yet
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[240px]">
              Add supplementary notes, formulas, checklists, or code snippets
              for this topic.
            </p>
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="mt-3 inline-flex items-center gap-1 text-xs text-accent font-medium hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add first sub-section</span>
            </button>
          </div>
        )}

        {subComments.map((comment) => {
          const isCurrentlyEditing = editingCommentId === comment.id;
          return (
            <div
              key={comment.id}
              onDoubleClick={() => handleStartEdit(comment)}
              className={`p-3 rounded-xl space-y-1.5 text-xs transition-colors group cursor-default ${
                isCurrentlyEditing
                  ? "bg-accent-subtle border border-accent/40 ring-1 ring-accent/30 shadow-2xs"
                  : "bg-card border border-border shadow-2xs hover:border-border"
              }`}
              title="Double-click to edit"
            >
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                {comment.author && comment.author.trim() ? (
                  <span className="font-semibold text-foreground truncate pr-2">
                    {comment.author}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {comment.timestamp}
                    </span>
                    {isCurrentlyEditing && (
                      <span className="text-[10px] font-medium text-accent bg-accent-subtle px-1.5 py-0.5 rounded-sm">
                        Editing
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  {comment.author && comment.author.trim() && (
                    <span className="text-[10px] text-muted-foreground mr-1">
                      {comment.timestamp}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(comment);
                    }}
                    className={`transition-opacity cursor-pointer p-1 rounded hover:bg-subtle ${
                      isCurrentlyEditing
                        ? "text-accent opacity-100"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-accent"
                    }`}
                    title="Edit sub-section"
                    aria-label="Edit sub-section"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSubComment(comment.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity cursor-pointer p-1 rounded-sm hover:bg-subtle"
                    title="Delete sub-section"
                    aria-label="Delete sub-section"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-foreground leading-relaxed text-xs">
                <MarkdownRenderer content={comment.content} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Composer Dock with TipTap Live Markdown Editor & Complete Toolbar */}
      {isAdding ? (
        <div className="border-t border-border bg-card flex flex-col shrink-0 animate-in slide-in-from-bottom-2 duration-150">
          <EditorToolbar
            editor={editor}
            compact
            className="border-b border-border-subtle"
          />

          {/* Editable Editor Area */}
          <div
            className="p-1 cursor-text"
            onClick={() => {
              if (editor && !editor.isFocused) {
                editor.commands.focus();
              }
            }}
          >
            <EditorContent editor={editor} />
          </div>

          {/* Action Row */}
          <div className="px-3 py-2 border-t border-border-subtle flex items-center justify-between bg-subtle">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <span>
                Press Ctrl+Enter to {editingCommentId ? "save" : "add"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCloseAddForm}
                className="px-2.5 py-1 rounded-sm text-muted-foreground hover:bg-card text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubComment}
                className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-hover cursor-pointer shadow-2xs transition-colors"
              >
                {editingCommentId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2.5 border-t border-border-subtle bg-card flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg border border-border bg-subtle text-muted-foreground hover:text-foreground hover:border-border text-xs transition-colors cursor-pointer"
          >
            <span>Add a sub-section...</span>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
