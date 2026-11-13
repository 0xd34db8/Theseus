"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from "lucide-react";
import {
  MediaAlign,
  normalizeMediaAlign,
  parseMediaWidth,
} from "@/lib/youtube";

const SIZE_PRESETS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "100%", pct: 1.0 },
] as const;

export interface ResizableMediaFrameProps {
  editor: NodeViewProps["editor"];
  node: NodeViewProps["node"];
  updateAttributes: NodeViewProps["updateAttributes"];
  selected: boolean;
  getPos: NodeViewProps["getPos"];
  deleteNode: NodeViewProps["deleteNode"];
  minWidth?: number;
  defaultFillWidth?: boolean;
  dataType?: string;
  deleteLabel?: string;
  extraToolbarActions?: React.ReactNode;
  children: (state: {
    isResizing: boolean;
    isHovered: boolean;
    handleSelect: (e: React.MouseEvent) => void;
  }) => React.ReactNode;
}

/**
 * Shared alignable & drag-resizable wrapper with floating context controls for images and embeds.
 */
export const ResizableMediaFrame: React.FC<ResizableMediaFrameProps> = ({
  editor,
  node,
  updateAttributes,
  selected,
  getPos,
  deleteNode,
  minWidth = 80,
  defaultFillWidth = false,
  dataType,
  deleteLabel = "Delete",
  extraToolbarActions,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const latestWidthRef = useRef<number | null>(parseMediaWidth(node.attrs.width));

  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(() =>
    parseMediaWidth(node.attrs.width),
  );
  const [toolbarCoords, setToolbarCoords] = useState<{
    top: number;
    left: number;
    visible: boolean;
  } | null>(null);

  const isEditable = editor?.isEditable ?? false;
  const textAlign = normalizeMediaAlign(node.attrs.textAlign);

  useEffect(() => {
    if (!isResizing) {
      const parsed = parseMediaWidth(node.attrs.width);
      latestWidthRef.current = parsed;
      setLiveWidth(parsed);
    }
  }, [node.attrs.width, isResizing]);

  const selectNode = useCallback(() => {
    if (!editor || typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos === "number") {
      editor.commands.setNodeSelection(pos);
    }
  }, [editor, getPos]);

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectNode();
    },
    [selectNode],
  );

  const handleAlign = useCallback(
    (alignment: MediaAlign) => {
      updateAttributes({ textAlign: alignment });
      if (editor && typeof getPos === "function") {
        const pos = getPos();
        if (typeof pos === "number") {
          editor.chain().setNodeSelection(pos).setTextAlign(alignment).run();
        }
      }
    },
    [editor, getPos, updateAttributes],
  );

  const getMaxContainerWidth = useCallback(() => {
    const container = containerRef.current;
    const parentElement =
      container?.closest(".ProseMirror") || container?.parentElement;
    return parentElement ? parentElement.clientWidth : 800;
  }, []);

  const startResize = useCallback(
    (e: React.MouseEvent, direction: "se" | "sw" | "e" | "w") => {
      if (!isEditable) return;
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      selectNode();

      const startX = e.clientX;
      const startWidth = container.getBoundingClientRect().width;
      const maxWidth = Math.max(minWidth, getMaxContainerWidth());

      setIsResizing(true);

      const onMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const deltaX = moveEvent.clientX - startX;
        const multiplier = textAlign === "center" ? 2 : 1;
        const rawWidth =
          direction === "se" || direction === "e"
            ? startWidth + deltaX * multiplier
            : startWidth - deltaX * multiplier;

        const clamped = Math.max(
          minWidth,
          Math.min(Math.round(rawWidth), maxWidth),
        );
        latestWidthRef.current = clamped;
        setLiveWidth(clamped);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        setIsResizing(false);

        const measured = containerRef.current
          ? Math.round(containerRef.current.getBoundingClientRect().width)
          : null;
        const finalWidth = latestWidthRef.current ?? measured;
        if (finalWidth) {
          updateAttributes({ width: finalWidth });
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [isEditable, minWidth, textAlign, selectNode, getMaxContainerWidth, updateAttributes],
  );

  const updateToolbarPosition = useCallback(() => {
    if (!selected || !isEditable || !containerRef.current) {
      setToolbarCoords(null);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const toolbarHeight = toolbarRef.current?.offsetHeight || 36;
    const toolbarWidth = toolbarRef.current?.offsetWidth || 320;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const visible = rect.bottom > 44 && rect.top < viewportH - 16;
    const aboveTop = rect.top - toolbarHeight - 8;
    const top =
      aboveTop >= 12 ? aboveTop : Math.max(12, Math.min(rect.top + 8, viewportH - toolbarHeight - 12));

    const centeredLeft = rect.left + rect.width / 2 - toolbarWidth / 2;
    const left = Math.max(8, Math.min(centeredLeft, viewportW - toolbarWidth - 8));

    setToolbarCoords({ top, left, visible });
  }, [selected, isEditable]);

  useEffect(() => {
    if (!selected || !isEditable) {
      setToolbarCoords(null);
      return;
    }

    updateToolbarPosition();
    const rafId = requestAnimationFrame(updateToolbarPosition);

    window.addEventListener("scroll", updateToolbarPosition, true);
    window.addEventListener("resize", updateToolbarPosition);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", updateToolbarPosition, true);
      window.removeEventListener("resize", updateToolbarPosition);
    };
  }, [selected, isEditable, liveWidth, textAlign, updateToolbarPosition]);

  const justifyClass =
    textAlign === "center"
      ? "justify-center"
      : textAlign === "right"
        ? "justify-end"
        : "justify-start";

  const containerStyle: React.CSSProperties = liveWidth
    ? { width: `${liveWidth}px`, maxWidth: "100%" }
    : defaultFillWidth
      ? { width: "100%", maxWidth: "42rem" }
      : { width: "auto", maxWidth: "100%" };

  return (
    <NodeViewWrapper
      className={`w-full flex my-3.5 first:mt-0 last:mb-0 select-none ${justifyClass}`}
      data-align={textAlign}
      data-type={dataType}
    >
      <div
        ref={containerRef}
        onClick={handleSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative inline-block group max-w-full"
        style={containerStyle}
      >
        {children({ isResizing, isHovered, handleSelect })}

        {/* Prevent iframes from swallowing pointer events mid-drag */}
        {isResizing && (
          <div
            className="fixed inset-0 z-50 cursor-ew-resize"
            aria-hidden="true"
          />
        )}

        {/* Resize Handles (editable only) */}
        {isEditable && (selected || isHovered) && (
          <>
            <div
              onMouseDown={(e) => startResize(e, "se")}
              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-accent border-2 border-card rounded-full z-20 cursor-nwse-resize hover:scale-125 transition-transform"
              title="Drag to resize"
            />
            <div
              onMouseDown={(e) => startResize(e, "sw")}
              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-accent border-2 border-card rounded-full z-20 cursor-nesw-resize hover:scale-125 transition-transform"
              title="Drag to resize"
            />
            <div
              onMouseDown={(e) => startResize(e, "e")}
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-7 bg-accent border border-card rounded-full z-20 cursor-ew-resize hover:scale-110 transition-transform"
              title="Drag to resize horizontally"
            />
            <div
              onMouseDown={(e) => startResize(e, "w")}
              className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-7 bg-accent border border-card rounded-full z-20 cursor-ew-resize hover:scale-110 transition-transform"
              title="Drag to resize horizontally"
            />
          </>
        )}

        {/* Live Size Tooltip while dragging */}
        {isResizing && liveWidth && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[10px] rounded-md pointer-events-none select-none z-30 font-mono">
            {liveWidth}px
          </div>
        )}
      </div>

      {/* Floating Context Toolbar via Portal */}
      {selected &&
        isEditable &&
        toolbarCoords?.visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={toolbarRef}
            data-floating-editor-ui="true"
            style={{
              position: "fixed",
              top: `${toolbarCoords.top}px`,
              left: `${toolbarCoords.left}px`,
              zIndex: 9998,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-1 px-2 py-1 bg-card border border-border rounded-xl text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            {(
              [
                { align: "left", title: "Align Left", Icon: AlignLeft },
                { align: "center", title: "Align Center", Icon: AlignCenter },
                { align: "right", title: "Align Right", Icon: AlignRight },
              ] as const
            ).map(({ align, title, Icon }) => (
              <button
                key={align}
                type="button"
                title={title}
                onClick={() => handleAlign(align)}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  textAlign === align
                    ? "text-accent bg-accent-subtle"
                    : "text-foreground-subtle hover:bg-subtle"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}

            <div className="w-px h-3.5 bg-border mx-0.5" />

            {SIZE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                title={`Set width to ${preset.label}`}
                onClick={() => {
                  const maxW = getMaxContainerWidth();
                  const targetWidth = Math.max(
                    minWidth,
                    Math.min(Math.round(maxW * preset.pct), maxW),
                  );
                  latestWidthRef.current = targetWidth;
                  setLiveWidth(targetWidth);
                  updateAttributes({ width: targetWidth });
                }}
                className="px-1.5 py-0.5 text-[10px] font-medium text-foreground-subtle hover:text-foreground hover:bg-subtle rounded-sm transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}

            {liveWidth && (
              <button
                type="button"
                title="Reset to default size"
                onClick={() => {
                  latestWidthRef.current = null;
                  setLiveWidth(null);
                  updateAttributes({ width: null });
                }}
                className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-subtle rounded-sm transition-colors cursor-pointer"
              >
                Auto
              </button>
            )}

            {extraToolbarActions}

            <div className="w-px h-3.5 bg-border mx-0.5" />

            <button
              type="button"
              title={deleteLabel}
              onClick={() => deleteNode()}
              className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  );
};
