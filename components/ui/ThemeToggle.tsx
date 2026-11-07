"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Monitor,
  Sun,
  Moon,
  BookOpen,
  Compass,
  Disc,
  Leaf,
  Check,
} from "lucide-react";
import { THEMES, type ThemeMode } from "@/lib/theme";
import { useTheme } from "@/hooks/useTheme";

export type { ThemeMode };

const THEME_ICONS: Record<ThemeMode, React.ComponentType<{ className?: string }>> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
  sepia: BookOpen,
  nord: Compass,
  midnight: Disc,
  forest: Leaf,
};

export const ThemeToggle: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const { theme: currentTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-full ${className}`} aria-hidden="true" />
    );
  }

  const activeOption =
    THEMES.find((t) => t.id === currentTheme) || THEMES[0];
  const ActiveIcon = THEME_ICONS[activeOption.id];

  return (
    <div ref={containerRef} className="relative inline-block font-manrope">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Theme: ${activeOption.name}. Click to change theme.`}
        title={`Current theme: ${activeOption.name}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`p-2 rounded-full border border-border bg-card text-foreground-subtle hover:text-foreground shadow-2xs hover:border-border transition-all cursor-pointer flex items-center justify-center ${className}`}
      >
        <ActiveIcon className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-card rounded-2xl border border-border shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-manrope">
          <div className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border-subtle">
            Appearance
          </div>

          <div className="py-1">
            {THEMES.map((theme) => {
              const Icon = THEME_ICONS[theme.id];
              const isSelected = currentTheme === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-subtle text-foreground font-medium"
                      : "text-foreground-subtle hover:bg-subtle"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Swatch preview */}
                    <div className="flex items-center -space-x-1 shrink-0">
                      <span
                        className="w-3 h-3 rounded-full border border-border"
                        style={{ backgroundColor: theme.swatch[0] }}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-border"
                        style={{ backgroundColor: theme.swatch[1] }}
                      />
                    </div>

                    <span className="font-normal">{theme.name}</span>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
