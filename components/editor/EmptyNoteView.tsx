"use client";

import React from "react";
import { SyllabusItem } from "@/types/syllabus";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import {
  Edit3,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

interface EmptyNoteViewProps {
  topic: SyllabusItem;
  isEditingTitle: boolean;
  titleValue: string;
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  onTitleChange: (val: string) => void;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
  onCreateNote: () => void;
  onAiGenerateNotes: () => void;
  onCopyNotePrompt: () => void;
  isAiGenerating: boolean;
  hasCopiedNotePrompt: boolean;
  aiError: string | null;
  isApiKeyModalOpen: boolean;
  onOpenApiKeyModal: () => void;
  onCloseApiKeyModal: () => void;
  onClose: () => void;
  onBackToTree?: () => void;
}

export const EmptyNoteView: React.FC<EmptyNoteViewProps> = ({
  topic,
  isEditingTitle,
  titleValue,
  titleInputRef,
  onTitleChange,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onCreateNote,
  onAiGenerateNotes,
  onCopyNotePrompt,
  isAiGenerating,
  hasCopiedNotePrompt,
  aiError,
  isApiKeyModalOpen,
  onOpenApiKeyModal,
  onCloseApiKeyModal,
  onClose,
  onBackToTree,
}) => {
  return (
    <div className="h-full flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 font-manrope">
      <div className="w-full flex justify-between items-center text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          {onBackToTree && (
            <button
              type="button"
              onClick={onBackToTree}
              className="md:hidden flex items-center gap-1 px-2 py-1 text-xs text-foreground-subtle hover:text-foreground rounded-md hover:bg-subtle transition-colors cursor-pointer"
              title="Back to Topics"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Tree</span>
            </button>
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider">
            {topic.id}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-subtle rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Centered Topic Title: Click to rename inline */}
      <div className="text-center my-auto space-y-5 max-w-md w-full">
        {isEditingTitle ? (
          <div className="w-full">
            <input
              ref={titleInputRef}
              type="text"
              value={titleValue}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveTitle();
                else if (e.key === "Escape") onCancelEditTitle();
              }}
              onBlur={onSaveTitle}
              autoFocus
              className="text-2xl md:text-3xl font-light text-foreground tracking-tight text-center bg-transparent border-b-2 border-accent focus:outline-hidden px-2 py-0.5 w-full font-manrope"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartEditTitle}
            className="group inline-flex items-center justify-center gap-2 px-3 py-1 rounded-xl hover:bg-subtle transition-colors cursor-pointer text-center max-w-full"
            title="Click to rename topic"
          >
            <h2 className="text-2xl md:text-3xl font-light text-foreground tracking-tight truncate">
              {topic.title}
            </h2>
            <Edit3 className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        )}

        <div className="space-y-4">
          <p className="text-sm font-light text-muted-foreground italic">
            no notes yet
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onCreateNote}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-full text-xs font-medium shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Note</span>
            </button>

            {/* Two-in-one button: Generate with AI + Copy Prompt */}
            <div className="inline-flex items-center rounded-full bg-linear-to-r from-green-600 to-emerald-600 text-white shadow-xs transition-all overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={onAiGenerateNotes}
                disabled={isAiGenerating}
                className="inline-flex items-center gap-2 pl-4 pr-3 py-2 hover:bg-black/10 transition-colors cursor-pointer disabled:opacity-60"
                title="Generate study notes with AI"
              >
                {isAiGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Notes...</span>
                  </>
                ) : (
                  <span>Generate with AI</span>
                )}
              </button>
              <div className="w-px h-4 bg-white/25" />
              <button
                type="button"
                onClick={onCopyNotePrompt}
                className="inline-flex items-center justify-center px-3 py-2 hover:bg-black/10 transition-colors cursor-pointer"
                title={
                  hasCopiedNotePrompt
                    ? "Prompt Copied"
                    : "Copy note prompt for external LLM"
                }
              >
                {hasCopiedNotePrompt ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          </div>

          {aiError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{aiError}</span>
                <div>
                  <button
                    onClick={onOpenApiKeyModal}
                    className="text-xs font-medium text-red-500 underline"
                  >
                    Configure API Key
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full" />

      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={onCloseApiKeyModal} />
    </div>
  );
};
