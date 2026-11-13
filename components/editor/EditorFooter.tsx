"use client";

import React, { useState } from "react";
import { ListTree, ChevronUp } from "lucide-react";
import { SyllabusItem, TopicNote } from "@/types/syllabus";
import { StatusChip } from "./StatusChip";
import { SubsectionsDrawer } from "./SubsectionsDrawer";

export interface EditorFooterProps {
  items: SyllabusItem[];
  selectedTopic: SyllabusItem | null;
  mobileTab: "tree" | "editor";
  onSelectMobileTab: (tab: "tree" | "editor") => void;
  onSaveNote: (topicId: string, note: TopicNote) => void;
}

const MOBILE_TABS = [
  { id: "tree", label: "Tree" },
  { id: "editor", label: "Note" },
] as const;

/**
 * Editor bottom bar with syllabus completion status, mobile panel switcher, and sub-sections drawer.
 */
export const EditorFooter: React.FC<EditorFooterProps> = ({
  items,
  selectedTopic,
  mobileTab,
  onSelectMobileTab,
  onSaveNote,
}) => {
  const [isSubsectionsOpen, setIsSubsectionsOpen] = useState(false);
  const subCount = selectedTopic?.note?.subComments?.length || 0;

  return (
    <footer className="border-t border-border-subtle bg-background flex flex-col shrink-0 z-20 font-manrope">
      {isSubsectionsOpen && selectedTopic && (
        <SubsectionsDrawer
          selectedTopic={selectedTopic}
          onSaveNote={onSaveNote}
          onClose={() => setIsSubsectionsOpen(false)}
        />
      )}

      <div className="px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusChip items={items} />
        </div>

        {/* Mobile View Switcher between Syllabus Tree and Note Editor */}
        <div className="flex md:hidden items-center p-0.5 bg-subtle rounded-full text-xs font-medium shadow-2xs">
          {MOBILE_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectMobileTab(id)}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                mobileTab === id
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right Side: Sub-sections Trigger & Branding */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-subsections-trigger="true"
            onClick={() => {
              if (!selectedTopic) return;
              setIsSubsectionsOpen((prev) => !prev);
            }}
            disabled={!selectedTopic}
            className={`group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-normal tracking-tight shadow-2xs transition-all cursor-pointer ${
              !selectedTopic
                ? "bg-subtle text-muted-foreground border border-border/40 cursor-not-allowed"
                : isSubsectionsOpen
                  ? "bg-primary text-primary-foreground border border-transparent shadow-2xs"
                  : "bg-card text-foreground border border-border hover:bg-subtle"
            }`}
            title={
              selectedTopic
                ? `Sub-sections for "${selectedTopic.title}" (${subCount})`
                : "Select a topic to view or add sub-sections"
            }
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>Sub-sections</span>
            {subCount > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-semibold ${
                  isSubsectionsOpen
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-subtle text-foreground-subtle"
                }`}
              >
                {subCount}
              </span>
            )}
            <ChevronUp
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isSubsectionsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <div className="text-[11px] text-muted-foreground font-light select-none hidden xs:block">
            Theseus
          </div>
        </div>
      </div>
    </footer>
  );
};
