"use client";

import React, { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Search, Download, Key, X, ChevronUp, ChevronDown } from "lucide-react";

interface TopBarProps {
  fileName: string;
  onFileNameChange: (name: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  searchMatchInfo?: { current: number; total: number } | null;
  onFindNext?: () => void;
  onFindPrev?: () => void;
  onExport?: () => void;
  onApiKeyClick?: () => void;
  apiKeyConfigured?: boolean;
  onHomeClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  fileName,
  onFileNameChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search in note...",
  searchMatchInfo,
  onFindNext,
  onFindPrev,
  onExport,
  onApiKeyClick,
  apiKeyConfigured,
  onHomeClick,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(fileName);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempName.trim()) {
      onFileNameChange(tempName.trim());
    } else {
      setTempName(fileName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setTempName(fileName);
      setIsEditing(false);
    }
  };

  // If mobile search overlay is open, show full-width search bar in header
  if (isMobileSearchOpen) {
    return (
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-background select-none font-manrope border-b border-border-subtle md:border-b-0 animate-in fade-in duration-150">
        <div className="relative flex-1 flex items-center mr-2">
          <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            data-editor-search-input="true"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.shiftKey) onFindPrev?.();
                else onFindNext?.();
              } else if (e.key === "Escape") {
                setIsMobileSearchOpen(false);
                onSearchChange("");
              }
            }}
            placeholder={searchPlaceholder}
            autoFocus
            className="w-full pl-8 pr-16 py-1.5 text-xs bg-card border border-border rounded-full outline-hidden focus:border-accent font-manrope text-foreground placeholder-muted-foreground"
          />
          {searchQuery && (
            <div className="absolute right-2 flex items-center gap-1">
              {searchMatchInfo && (
                <span className="text-[10px] text-muted-foreground font-mono select-none">
                  {searchMatchInfo.total > 0
                    ? `${searchMatchInfo.current}/${searchMatchInfo.total}`
                    : "0/0"}
                </span>
              )}
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="p-1 text-muted-foreground hover:text-foreground rounded-sm cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setIsMobileSearchOpen(false);
            onSearchChange("");
          }}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-subtle transition-colors cursor-pointer"
          title="Close search"
        >
          <X className="w-4 h-4" />
        </button>
      </header>
    );
  }

  const titleElement = (
    <h1 className="flex items-center text-base sm:text-xl md:text-2xl font-light tracking-tight text-foreground font-manrope min-w-0 m-0">
      {isEditing ? (
        <input
          type="text"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="bg-transparent border-b border-border outline-hidden text-foreground font-light px-1 py-0 font-manrope min-w-[100px] max-w-[180px] sm:min-w-[200px] text-base sm:text-xl md:text-2xl"
        />
      ) : (
        <span
          onClick={() => {
            setTempName(fileName);
            setIsEditing(true);
          }}
          title="Click to rename"
          className="cursor-pointer hover:opacity-80 transition-opacity truncate max-w-[140px] xs:max-w-[190px] sm:max-w-xs md:max-w-md lg:max-w-xl"
        >
          {fileName}
        </span>
      )}
    </h1>
  );

  const actions = (
    <>
      {/* Mobile Search Icon Button */}
      <button
        type="button"
        onClick={() => setIsMobileSearchOpen(true)}
        className="flex md:hidden p-2 rounded-full border border-border bg-card text-foreground-subtle hover:text-foreground shadow-2xs hover:border-border transition-all cursor-pointer items-center justify-center"
        title="Search in note"
        aria-label="Search in note"
      >
        <Search className="w-3.5 h-3.5" />
      </button>

      {/* Desktop Search Bar (Dedicated to Editor) */}
      <div className="relative hidden md:flex items-center">
        <input
          data-editor-search-input="true"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) {
                onFindPrev?.();
              } else {
                onFindNext?.();
              }
            } else if (e.key === "Escape") {
              onSearchChange("");
            }
          }}
          placeholder={searchPlaceholder}
          aria-label="Search in note"
          className={`${
            searchQuery ? "w-44 lg:w-48 pr-20" : "w-36 pr-7.5"
          } pl-3.5 py-1.5 text-xs font-normal bg-card text-foreground placeholder-muted-foreground rounded-full border border-border shadow-2xs focus:outline-hidden focus:border-accent transition-all font-manrope`}
        />

        {searchQuery ? (
          <div className="absolute right-2 flex items-center gap-0.5">
            {searchMatchInfo && (
              <span className="text-[10px] text-muted-foreground font-mono select-none px-1">
                {searchMatchInfo.total > 0
                  ? `${searchMatchInfo.current}/${searchMatchInfo.total}`
                  : "0/0"}
              </span>
            )}
            {searchMatchInfo && searchMatchInfo.total > 1 && (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={onFindPrev}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded-sm hover:bg-subtle cursor-pointer"
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={onFindNext}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded-sm hover:bg-subtle cursor-pointer"
                  title="Next match (Enter)"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-subtle cursor-pointer transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <Search className="absolute right-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* API Key button */}
      {onApiKeyClick && (
        <button
          type="button"
          onClick={onApiKeyClick}
          title="Configure API Key"
          className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full border text-xs font-normal transition-all cursor-pointer font-manrope ${
            apiKeyConfigured
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
              : "bg-card border-border text-foreground-subtle hover:border-border shadow-2xs hover:bg-subtle"
          }`}
        >
          <Key className="w-3.5 h-3.5 text-foreground-subtle" />
          <span className="hidden sm:inline">
            {apiKeyConfigured ? "API Ready" : "API Key"}
          </span>
        </button>
      )}

      {/* Export .theseus button */}
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          title="Download as .theseus format (Ctrl+S)"
          className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full border border-border bg-card hover:bg-subtle text-foreground-subtle text-xs font-normal shadow-2xs hover:border-border transition-all font-manrope cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-foreground-subtle" />
          <span className="hidden sm:inline">Export .theseus</span>
        </button>
      )}
    </>
  );

  return (
    <AppHeader
      titleElement={titleElement}
      actions={actions}
      onHomeClick={onHomeClick}
    />
  );
};
