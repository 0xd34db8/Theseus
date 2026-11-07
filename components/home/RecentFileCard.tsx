"use client";

import React, { useState, useEffect, useRef } from "react";
import { SyllabusData } from "@/types/syllabus";
import { calculateSyllabusStats } from "@/lib/syllabusUtils";
import { Clock, Trash2, Check, X } from "lucide-react";

interface RecentFileCardProps {
  file: SyllabusData;
  onOpen: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export const RecentFileCard: React.FC<RecentFileCardProps> = ({
  file,
  onOpen,
  onDelete,
}) => {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const confirmContainerRef = useRef<HTMLDivElement>(null);
  const stats = calculateSyllabusStats(file.items);

  // Close confirmation on Escape key or Click Outside
  useEffect(() => {
    if (!isConfirming) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsConfirming(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        confirmContainerRef.current &&
        !confirmContainerRef.current.contains(e.target as Node)
      ) {
        setIsConfirming(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isConfirming]);

  return (
    <div
      onClick={() => {
        if (isConfirming) {
          setIsConfirming(false);
          return;
        }
        onOpen(file.id);
      }}
      className="group px-5 py-4 rounded-2xl border border-border hover:border-border-subtle hover:shadow-2xs transition-all cursor-pointer bg-subtle hover:bg-card flex items-center justify-between font-manrope"
    >
      <div className="min-w-0 pr-4">
        <h3 className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
          {file.fileName}
        </h3>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {file.lastModified || "Recently"}
          </span>
          <span>•</span>
          <span>{stats.total} topics</span>
        </div>
      </div>

      {/* Progress Chip */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="px-3 py-1 rounded-full bg-status-done-bg text-status-done-fg border border-status-done-border text-[11px] font-normal tracking-tight shadow-2xs"
          title="Progress (% completed)"
        >
          {stats.done.pct}% done
        </div>

        {isConfirming ? (
          <div
            ref={confirmContainerRef}
            className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tick (Confirm removal) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e, file.id);
              }}
              className="p-1.5 rounded-full hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
              title="Confirm remove"
              aria-label={`Confirm remove ${file.fileName}`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* Cross (Cancel) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsConfirming(false);
              }}
              className="p-1.5 rounded-full hover:bg-subtle text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Cancel"
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsConfirming(true);
            }}
            className="p-1.5 rounded-full hover:bg-subtle text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Remove from recents"
            aria-label={`Remove ${file.fileName} from recents`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
