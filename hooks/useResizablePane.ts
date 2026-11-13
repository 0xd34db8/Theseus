import { useState, useEffect, useRef, useCallback } from "react";

const TREE_WIDTH_STORAGE_KEY = "theseus_tree_width";
const MIN_PANE_WIDTH = 260;
const MAX_PANE_WIDTH = 800;
const DEFAULT_PANE_WIDTH = 380;
const EDITOR_MIN_WIDTH = 380;

function persistWidth(width: number | null) {
  try {
    if (width === null) {
      localStorage.removeItem(TREE_WIDTH_STORAGE_KEY);
    } else {
      localStorage.setItem(TREE_WIDTH_STORAGE_KEY, String(width));
    }
  } catch {
    // Storage unavailable (private browsing, quota)
  }
}

/**
 * Manages persisted horizontal split-pane width, pointer dragging, keyboard nudging, and viewport clamping.
 */
export function useResizablePane() {
  const [treeWidth, setTreeWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const treePaneRef = useRef<HTMLDivElement | null>(null);
  const treeWidthRef = useRef<number | null>(null);

  const getMaxAllowedWidth = useCallback(() => {
    if (!containerRef.current) return MAX_PANE_WIDTH;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    return Math.max(
      MIN_PANE_WIDTH,
      Math.min(MAX_PANE_WIDTH, containerWidth - EDITOR_MIN_WIDTH),
    );
  }, []);

  // Load saved width on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TREE_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= MIN_PANE_WIDTH && parsed <= 900) {
          setTreeWidth(parsed);
          treeWidthRef.current = parsed;
        }
      }
    } catch {
      // Ignore unavailable storage
    }
  }, []);

  // Drag listeners
  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!treePaneRef.current || !containerRef.current) return;
      const treeLeft = treePaneRef.current.getBoundingClientRect().left;
      const rawWidth = e.clientX - treeLeft;
      const maxWidth = getMaxAllowedWidth();
      const clamped = Math.round(
        Math.min(Math.max(rawWidth, MIN_PANE_WIDTH), maxWidth),
      );
      setTreeWidth(clamped);
      treeWidthRef.current = clamped;
    };

    const onMouseUp = () => {
      setIsResizing(false);
      if (treeWidthRef.current !== null) {
        persistWidth(treeWidthRef.current);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, getMaxAllowedWidth]);

  // Clamp width when window shrinks
  useEffect(() => {
    const handleWindowResize = () => {
      if (!containerRef.current) return;
      const maxAllowed = getMaxAllowedWidth();
      setTreeWidth((prev) => {
        if (prev !== null && prev > maxAllowed) {
          treeWidthRef.current = maxAllowed;
          persistWidth(maxAllowed);
          return maxAllowed;
        }
        return prev;
      });
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [getMaxAllowedWidth]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResetWidth = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTreeWidth(null);
    treeWidthRef.current = null;
    persistWidth(null);
  }, []);

  const nudgeWidth = useCallback(
    (delta: number) => {
      const maxWidth = getMaxAllowedWidth();
      setTreeWidth((prev) => {
        const current = prev ?? DEFAULT_PANE_WIDTH;
        const next = Math.min(maxWidth, Math.max(MIN_PANE_WIDTH, current + delta));
        treeWidthRef.current = next;
        persistWidth(next);
        return next;
      });
    },
    [getMaxAllowedWidth],
  );

  return {
    treeWidth,
    isResizing,
    containerRef,
    treePaneRef,
    handleResizeStart,
    handleResetWidth,
    nudgeWidth,
  };
}
