"use client";

import React from "react";
import Link from "next/link";
import { TheseusLogo } from "@/components/ui/TheseusLogo";

interface AppHeaderProps {
  /**
   * Title or interactive element displayed beside the Theseus logo
   */
  titleElement?: React.ReactNode;
  /**
   * Right-aligned controls (e.g. search, export button, API key trigger)
   */
  actions?: React.ReactNode;
  /**
   * Optional custom close/minimize/maximize handlers
   */
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onHomeClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  titleElement,
  actions,
  onHomeClick,
}) => {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-2.5 sm:py-3.5 bg-background select-none font-manrope border-b border-border-subtle md:border-b-0">
      {/* Left: Theseus Logo + Title/FileName */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 mr-2">
        <Link
          href="/"
          onClick={onHomeClick}
          title="Theseus Home"
          className="flex items-center shrink-0"
        >
          <TheseusLogo className="h-10 w-auto sm:h-[53px] hover:opacity-90 transition-opacity cursor-pointer drop-shadow-xs" />
        </Link>

        {titleElement ? (
          titleElement
        ) : (
          <h1 className="text-xl sm:text-2xl md:text-3xl font-light tracking-tight text-foreground truncate">
            Theseus
          </h1>
        )}
      </div>

      {/* Right: Actions (pushed to the right position) */}
      {actions && (
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};
