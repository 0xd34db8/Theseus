"use client";

import React, { useState, useRef, useEffect } from "react";
import { TopicStatus } from "@/types/syllabus";
import { TOPIC_STATUS_META, TOPIC_STATUS_ORDER } from "@/lib/syllabusUtils";
import { Check, ChevronDown } from "lucide-react";

interface TopicStatusMenuProps {
  topicId: string;
  status: TopicStatus;
  onUpdateStatus: (topicId: string, status: TopicStatus) => void;
}

export const TopicStatusMenu: React.FC<TopicStatusMenuProps> = ({
  topicId,
  status,
  onUpdateStatus,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [topicId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentMeta = TOPIC_STATUS_META[status] || TOPIC_STATUS_META.untouched;

  return (
    <div ref={dropdownRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium py-1 pl-2.5 pr-2 rounded-full border outline-hidden cursor-pointer transition-colors ${currentMeta.pillClassName}`}
        title="Change status"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{currentMeta.label}</span>
        <ChevronDown
          className={`w-3 h-3 opacity-60 text-current shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Topic status"
          className="absolute left-0 top-full mt-1.5 w-36 bg-card rounded-xl border border-border py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {TOPIC_STATUS_ORDER.map((statusKey) => {
            const opt = TOPIC_STATUS_META[statusKey];
            const isSelected = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onUpdateStatus(topicId, opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between cursor-pointer transition-colors ${opt.optionClassName}`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
