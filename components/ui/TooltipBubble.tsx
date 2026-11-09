"use client";

import React, { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface TooltipBubbleProps {
  content: string | React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const TooltipBubble: React.FC<TooltipBubbleProps> = ({
  content,
  children,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isVisible = isOpen || isHovered;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
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
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        aria-label="More information"
        aria-expanded={isVisible}
        onClick={handleToggle}
        className="text-muted-foreground/60 hover:text-foreground focus:text-foreground focus:outline-hidden transition-colors cursor-pointer p-0.5 rounded-full inline-flex items-center justify-center"
      >
        {children || <HelpCircle className="w-3.5 h-3.5" />}
      </button>

      {isVisible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 sm:w-64 max-w-[280px] p-3 rounded-2xl bg-card border border-border shadow-lg text-foreground text-xs font-normal leading-relaxed text-center z-50 pointer-events-auto select-text animate-in fade-in zoom-in-95 duration-150"
        >
          {content}
          {/* Speech bubble downward beak pointing directly to the '?' icon */}
          <div
            aria-hidden="true"
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-b border-r border-border rotate-45"
          />
        </div>
      )}
    </div>
  );
};
