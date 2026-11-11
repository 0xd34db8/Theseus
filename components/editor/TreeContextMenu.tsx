"use client";

import React from "react";
import { SyllabusItem, TopicStatus } from "@/types/syllabus";
import { Check, FileText, Plus, Pencil, Trash2 } from "lucide-react";

export interface TreeContextMenuProps {
  item: SyllabusItem;
  position?: { x: number; y: number } | null;
  onUpdateStatus: (itemId: string, status: TopicStatus) => void;
  onToggleNote?: (itemId: string) => void;
  onStartAddSubtopic?: (itemId: string) => void;
  onStartRename?: (itemId: string, currentTitle: string) => void;
  onDeleteTopic?: (itemId: string) => void;
  onClose: () => void;
}

export function TreeContextMenu({
  item,
  position,
  onUpdateStatus,
  onToggleNote,
  onStartAddSubtopic,
  onStartRename,
  onDeleteTopic,
  onClose,
}: TreeContextMenuProps) {
  return (
    <div
      data-tree-context-menu="true"
      className={`${
        position ? "fixed" : "absolute right-0 top-full mt-1"
      } w-44 bg-card rounded-xl shadow-xl border border-border py-1.5 z-50 text-xs text-foreground animate-in fade-in zoom-in-95 duration-100`}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={() => {
          onUpdateStatus(item.id, "done");
          onClose();
        }}
        className="w-full px-3 py-1 text-left flex items-center justify-between hover:bg-status-done-bg text-status-done-fg font-medium cursor-pointer"
      >
        <span>Done</span>
        {item.status === "done" && <Check className="w-3 h-3" />}
      </button>

      <button
        type="button"
        onClick={() => {
          onUpdateStatus(item.id, "partial");
          onClose();
        }}
        className="w-full px-3 py-1 text-left flex items-center justify-between hover:bg-status-partial-bg text-status-partial-fg font-medium cursor-pointer"
      >
        <span>Partially</span>
        {item.status === "partial" && <Check className="w-3 h-3" />}
      </button>

      <button
        type="button"
        onClick={() => {
          onUpdateStatus(item.id, "barely");
          onClose();
        }}
        className="w-full px-3 py-1 text-left flex items-center justify-between hover:bg-status-barely-bg text-status-barely-fg font-medium cursor-pointer"
      >
        <span>Barely</span>
        {item.status === "barely" && <Check className="w-3 h-3" />}
      </button>

      <button
        type="button"
        onClick={() => {
          onUpdateStatus(item.id, "untouched");
          onClose();
        }}
        className="w-full px-3 py-1 text-left flex items-center justify-between hover:bg-subtle text-foreground-subtle cursor-pointer"
      >
        <span>Untouched</span>
        {item.status === "untouched" && <Check className="w-3 h-3" />}
      </button>

      <div className="my-1 border-t border-border-subtle" />

      {/* Note Toggle */}
      {onToggleNote && (
        <button
          type="button"
          onClick={() => {
            onToggleNote(item.id);
            onClose();
          }}
          className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-subtle text-foreground-subtle cursor-pointer"
        >
          <FileText className="w-3 h-3" />
          <span>{item.hasNote ? "Remove Note" : "Create Note"}</span>
        </button>
      )}

      {/* Add Subtopic */}
      {onStartAddSubtopic && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartAddSubtopic(item.id);
          }}
          className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-subtle text-foreground-subtle cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Add Subtopic</span>
        </button>
      )}

      {/* Rename Topic */}
      {onStartRename && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartRename(item.id, item.title);
          }}
          className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-subtle text-foreground-subtle cursor-pointer"
        >
          <Pencil className="w-3 h-3 text-muted-foreground" />
          <span>Rename Topic</span>
        </button>
      )}

      {/* Delete Topic */}
      {onDeleteTopic && (
        <>
          <div className="my-1 border-t border-border-subtle" />
          <button
            type="button"
            onClick={() => {
              onDeleteTopic(item.id);
              onClose();
            }}
            className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-red-500/10 text-red-500 font-medium cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-red-500" />
            <span>Delete Topic</span>
          </button>
        </>
      )}
    </div>
  );
}
