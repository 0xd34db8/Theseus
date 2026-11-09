"use client";

import React, { useState, useEffect, useRef } from "react";
import { TopBar } from "@/components/editor/TopBar";
import { SyllabusTree } from "@/components/editor/SyllabusTree";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { StatusChip } from "@/components/editor/StatusChip";
import { SubsectionsDrawer } from "@/components/editor/SubsectionsDrawer";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { ListTree, ChevronUp, RotateCcw } from "lucide-react";
import { initialSyllabusData } from "@/lib/mockData";
import {
  getSavedSyllabi,
  saveSyllabus,
  getActiveSyllabusId,
  getApiKey,
  cleanupUnusedDrafts,
} from "@/lib/storage";
import {
  findItemById,
  findParentItem,
  updateItemInTree,
  deleteItemFromTree,
  addItemToTree,
  exportSyllabusAsFile,
} from "@/lib/syllabusUtils";
import {
  SyllabusData,
  SyllabusItem,
  TopicNote,
  TopicStatus,
} from "@/types/syllabus";

export default function EditPage() {
  const [syllabus, setSyllabus] = useState<SyllabusData>(initialSyllabusData);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [editorSearchQuery, setEditorSearchQuery] = useState<string>("");
  const [searchMatchInfo, setSearchMatchInfo] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const searchActionsRef = useRef<{
    findNext: () => void;
    findPrev: () => void;
  } | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<"tree" | "editor">("tree");
  const [activePanel, setActivePanel] = useState<"tree" | "editor">("tree");
  const [isSubsectionsOpen, setIsSubsectionsOpen] = useState<boolean>(false);

  // Split pane resizing state
  const [treeWidth, setTreeWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const treePaneRef = useRef<HTMLDivElement | null>(null);
  const treeWidthRef = useRef<number | null>(null);

  // Structural tree snapshot (preserves latest notes across tree undo/redo)
  interface TreeSnapshotNode {
    id: string;
    title: string;
    status: TopicStatus;
    isExpanded?: boolean;
    hasNote?: boolean;
    note?: TopicNote;
    children?: TreeSnapshotNode[];
  }

  const [historyPast, setHistoryPast] = useState<TreeSnapshotNode[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<TreeSnapshotNode[][]>([]);

  const extractTreeSnapshot = (items: SyllabusItem[]): TreeSnapshotNode[] => {
    return items.map((it) => ({
      id: it.id,
      title: it.title,
      status: it.status,
      isExpanded: it.isExpanded,
      hasNote: it.hasNote,
      note: it.note,
      children: it.children ? extractTreeSnapshot(it.children) : undefined,
    }));
  };

  const restoreTreeFromSnapshot = (
    snapshot: TreeSnapshotNode[],
    currentItems: SyllabusItem[],
  ): SyllabusItem[] => {
    // Preserve all existing notes currently in the syllabus
    const notesMap = new Map<string, { note?: TopicNote; hasNote: boolean }>();
    function collect(items: SyllabusItem[]) {
      for (const it of items) {
        if (it.note || it.hasNote) {
          notesMap.set(it.id, { note: it.note, hasNote: it.hasNote });
        }
        if (it.children) collect(it.children);
      }
    }
    collect(currentItems);

    function apply(nodes: TreeSnapshotNode[]): SyllabusItem[] {
      return nodes.map((n) => {
        // If the topic currently exists in currentItems, keep its current latest note.
        // This guarantees tree undo/redo never reverts or resets note editor edits.
        // If the topic was deleted and is being restored by undo, use the saved note from snapshot.
        const currentSaved = notesMap.get(n.id);
        const hasNote = currentSaved !== undefined ? currentSaved.hasNote : Boolean(n.hasNote);
        const note = currentSaved !== undefined ? currentSaved.note : n.note;

        return {
          id: n.id,
          title: n.title,
          status: n.status,
          isExpanded: n.isExpanded ?? true,
          hasNote,
          note,
          children: n.children ? apply(n.children) : undefined,
        };
      });
    }

    return apply(snapshot);
  };

  const pushTreeHistory = (currentItems: SyllabusItem[]) => {
    const snapshot = extractTreeSnapshot(currentItems);
    setHistoryPast((prev) => [snapshot, ...prev.slice(0, 49)]);
    setHistoryFuture([]);
  };

  const handleTreeUndo = () => {
    if (historyPast.length === 0) return;
    const [prevSnapshot, ...remainingPast] = historyPast;
    const currentSnapshot = extractTreeSnapshot(syllabus.items);
    setHistoryFuture((prev) => [currentSnapshot, ...prev]);
    setHistoryPast(remainingPast);

    const restoredItems = restoreTreeFromSnapshot(prevSnapshot, syllabus.items);
    setSyllabus((prev) => {
      const updated = { ...prev, isDraft: false, items: restoredItems };
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleTreeRedo = () => {
    if (historyFuture.length === 0) return;
    const [nextSnapshot, ...remainingFuture] = historyFuture;
    const currentSnapshot = extractTreeSnapshot(syllabus.items);
    setHistoryPast((prev) => [currentSnapshot, ...prev]);
    setHistoryFuture(remainingFuture);

    const restoredItems = restoreTreeFromSnapshot(nextSnapshot, syllabus.items);
    setSyllabus((prev) => {
      const updated = { ...prev, isDraft: false, items: restoredItems };
      saveSyllabus(updated);
      return updated;
    });
  };

  // Keyboard shortcut listener: strictly respects whichever panel is clicked/active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F: routes to the search bar of whichever pane is highlighted/active
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement | null;
        const isInsideTree = Boolean(
          target && target.closest("[data-tree-pane]"),
        );
        const isInsideEditor = Boolean(
          target &&
            (target.closest("[data-editor-pane]") ||
              target.isContentEditable ||
              target.closest(".ProseMirror")),
        );

        const targetPanel = isInsideTree
          ? "tree"
          : isInsideEditor
            ? "editor"
            : activePanel;

        if (targetPanel === "tree") {
          const treeInput = document.querySelector<HTMLInputElement>(
            '[data-tree-search-input="true"]',
          );
          if (treeInput) {
            treeInput.focus();
            treeInput.select();
          }
        } else {
          const editorInput = document.querySelector<HTMLInputElement>(
            '[data-editor-search-input="true"]',
          );
          if (editorInput) {
            editorInput.focus();
            editorInput.select();
          }
        }
        return;
      }

      const isUndo =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey;
      const isRedo =
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey);

      if (!isUndo && !isRedo) return;

      const target = e.target as HTMLElement | null;
      const isInsideEditor = Boolean(
        target &&
          (target.closest("[data-editor-pane]") ||
            target.isContentEditable ||
            target.tagName === "TEXTAREA" ||
            (target.tagName === "INPUT" && !target.closest("[data-tree-pane]"))),
      );

      // If clicked/focused on editor, DO NOT TOUCH TREE! Let editor handle its own undo/redo natively.
      if (activePanel === "editor" || isInsideEditor) {
        return;
      }

      // If typing inside an input/textarea in the tree, let native input undo handle it
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target.closest("[data-tree-pane]")
      ) {
        return;
      }

      // If clicked/focused on tree, perform tree undo/redo
      e.preventDefault();
      e.stopPropagation();
      if (isUndo) {
        handleTreeUndo();
      } else {
        handleTreeRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [historyPast, historyFuture, activePanel, syllabus.items]);

  // Load active syllabus and api key on client
  useEffect(() => {
    const list = getSavedSyllabi(true);
    const activeId = getActiveSyllabusId();
    const active =
      (activeId ? list.find((s) => s.id === activeId) : null) ||
      list[0] ||
      initialSyllabusData;
    setSyllabus(active);
    if (active.items && active.items.length > 0) {
      setSelectedTopicId(active.items[0].id);
    }
    setApiKey(getApiKey());

    return () => {
      // Clean up any empty drafts if leaving without changes
      cleanupUnusedDrafts();
    };
  }, []);

  // Update browser tab title like professional tools: "<Open File Name> - Theseus"
  useEffect(() => {
    const rawName = syllabus.fileName?.trim();
    const targetTitle = rawName ? `${rawName} - Theseus` : "Untitled Syllabus - Theseus";

    const syncTitle = () => {
      if (document.title !== targetTitle) {
        document.title = targetTitle;
      }
      const titleTag = document.querySelector("title");
      if (titleTag && titleTag.textContent !== targetTitle) {
        titleTag.textContent = targetTitle;
      }
    };

    syncTitle();

    // Next.js App Router HeadManager or router navigation can asynchronously re-apply layout metadata ("Theseus").
    // A MutationObserver on document.head guarantees that the tab title stays synchronized to "<File Name> - Theseus".
    const observer = new MutationObserver(() => {
      syncTitle();
    });

    const head = document.head;
    if (head) {
      observer.observe(head, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    window.addEventListener("focus", syncTitle);

    return () => {
      observer.disconnect();
      window.removeEventListener("focus", syncTitle);
    };
  }, [syllabus.fileName]);

  // Ctrl + S (or Cmd + S) prompts to save / export as .theseus, not .html
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        exportSyllabusAsFile(syllabus);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [syllabus]);

  // Load saved tree pane width from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theseus_tree_width");
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 900) {
          setTreeWidth(parsed);
          treeWidthRef.current = parsed;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResetWidth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTreeWidth(null);
    treeWidthRef.current = null;
    try {
      localStorage.removeItem("theseus_tree_width");
    } catch {
      // ignore
    }
  };

  // Dragging event listeners for split pane resizer
  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!treePaneRef.current || !containerRef.current) return;
      const treeLeft = treePaneRef.current.getBoundingClientRect().left;
      const containerRect = containerRef.current.getBoundingClientRect();
      const rawWidth = e.clientX - treeLeft;
      const minWidth = 260;
      const maxWidth = Math.max(minWidth, Math.min(800, containerRect.width - 380));
      const clamped = Math.round(Math.min(Math.max(rawWidth, minWidth), maxWidth));
      setTreeWidth(clamped);
      treeWidthRef.current = clamped;
    };

    const onMouseUp = () => {
      setIsResizing(false);
      if (treeWidthRef.current !== null) {
        try {
          localStorage.setItem("theseus_tree_width", String(treeWidthRef.current));
        } catch {
          // ignore
        }
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
  }, [isResizing]);

  // Clamp tree width if window is resized smaller
  useEffect(() => {
    const handleWindowResize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const maxAllowed = Math.max(260, Math.min(800, containerWidth - 380));
      setTreeWidth((prev) => {
        if (prev !== null && prev > maxAllowed) {
          try {
            localStorage.setItem("theseus_tree_width", String(maxAllowed));
          } catch {}
          return maxAllowed;
        }
        return prev;
      });
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  const selectedTopic = findItemById(syllabus.items, selectedTopicId);
  const parentTopic = selectedTopicId
    ? findParentItem(syllabus.items, selectedTopicId)
    : null;

  // Toggle item expanded state
  const handleToggleExpand = (itemId: string) => {
    setSyllabus((prev) => {
      const updated = {
        ...prev,
        items: updateItemInTree(prev.items, itemId, (item) => ({
          ...item,
          isExpanded: !item.isExpanded,
        })),
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  // Update item progress status (done, partial, barely, untouched)
  const handleUpdateStatus = (itemId: string, status: TopicStatus) => {
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: updateItemInTree(prev.items, itemId, (item) => ({
          ...item,
          status,
        })),
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  // Save note for topic
  const handleSaveNote = (topicId: string, note: TopicNote) => {
    setSyllabus((prev) => {
      const updated = {
        ...prev,
        isDraft: false,
        items: updateItemInTree(prev.items, topicId, (item) => ({
          ...item,
          hasNote: true,
          note,
        })),
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  // Toggle note existence
  const handleToggleNote = (itemId: string) => {
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: updateItemInTree(prev.items, itemId, (item) => {
          const hasNote = !item.hasNote;
          return {
            ...item,
            hasNote,
            note: hasNote
              ? {
                  id: `note-${item.id}`,
                  title: item.title,
                  content: `### ${item.title}\n\nStart writing notes here...`,
                  updatedAt: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                }
              : undefined,
          };
        }),
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleFileNameChange = (name: string) => {
    setSyllabus((prev) => {
      const updated = { ...prev, isDraft: false, fileName: name };
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleDeleteTopic = (itemId: string) => {
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: deleteItemFromTree(prev.items, itemId),
      };
      saveSyllabus(updated);
      return updated;
    });
    if (selectedTopicId === itemId) {
      setSelectedTopicId("");
    }
  };

  const handleAddTopic = (parentId: string | null, title: string) => {
    const newItem: SyllabusItem = {
      id: `topic-${Date.now()}`,
      title: title.trim(),
      status: "untouched",
      hasNote: false,
    };
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: addItemToTree(prev.items, parentId, newItem),
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleRenameTopic = (itemId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: updateItemInTree(prev.items, itemId, (item) => ({
          ...item,
          title: trimmed,
          note: item.note ? { ...item.note, title: trimmed } : undefined,
        })),
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleExport = () => {
    exportSyllabusAsFile(syllabus);
  };

  const handleUpdateItems = (newItems: SyllabusItem[]) => {
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: newItems,
      };
      saveSyllabus(updated);
      return updated;
    });
  };

  return (
    <main className="h-screen w-full bg-background flex flex-col overflow-hidden font-manrope">
      <title>
        {syllabus.fileName?.trim()
          ? `${syllabus.fileName.trim()} - Theseus`
          : "Untitled Syllabus - Theseus"}
      </title>
      {/* Top Header Bar */}
      <TopBar
        fileName={syllabus.fileName}
        onFileNameChange={handleFileNameChange}
        searchQuery={editorSearchQuery}
        onSearchChange={setEditorSearchQuery}
        searchPlaceholder="Search in note..."
        searchMatchInfo={searchMatchInfo}
        onFindNext={() => searchActionsRef.current?.findNext()}
        onFindPrev={() => searchActionsRef.current?.findPrev()}
        onExport={handleExport}
        onApiKeyClick={() => setIsApiKeyModalOpen(true)}
        apiKeyConfigured={Boolean(apiKey)}
      />

      {/* Content Area with Split Panes taking full screen */}
      <div
        ref={containerRef}
        className="flex-1 flex px-3 sm:px-4 md:px-6 py-2 md:py-3 overflow-hidden min-h-0 relative"
      >
        {/* Left Pane: Syllabus Tree Card */}
        <div
          ref={treePaneRef}
          data-tree-pane="true"
          onClickCapture={() => setActivePanel("tree")}
          onFocusCapture={() => setActivePanel("tree")}
          style={treeWidth !== null ? { width: `${treeWidth}px` } : undefined}
          className={`w-full ${
            treeWidth !== null ? "" : "md:w-80 lg:w-96 xl:w-[380px]"
          } shrink-0 bg-card rounded-2xl md:rounded-[26px] border ${
            isResizing ? "transition-none" : "transition-all duration-200"
          } shadow-2xs flex flex-col overflow-hidden ${
            activePanel === "tree"
              ? "border-foreground/30 shadow-xs"
              : "border-border"
          } ${
            mobileTab === "tree" ? "flex" : "hidden md:flex"
          }`}
        >
          <SyllabusTree
            items={syllabus.items}
            courseTitle={syllabus.fileName}
            onUpdateTitle={handleFileNameChange}
            selectedTopicId={selectedTopicId}
            onSelectTopic={(topic) => {
              setSelectedTopicId(topic.id);
              setMobileTab("editor");
            }}
            onToggleExpand={handleToggleExpand}
            onUpdateStatus={handleUpdateStatus}
            onDeleteTopic={handleDeleteTopic}
            onAddTopic={handleAddTopic}
            onRenameTopic={handleRenameTopic}
            onToggleNote={handleToggleNote}
            onUpdateItems={handleUpdateItems}
            canUndo={historyPast.length > 0}
            canRedo={historyFuture.length > 0}
            onUndo={handleTreeUndo}
            onRedo={handleTreeRedo}
          />
        </div>

        {/* Resizable Divider Handle (Desktop) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize syllabus tree and editor panes"
          tabIndex={0}
          onMouseDown={handleResizeStart}
          onDoubleClick={handleResetWidth}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setTreeWidth((prev) => {
                const current = prev ?? 380;
                const next = Math.max(260, current - 20);
                try {
                  localStorage.setItem("theseus_tree_width", String(next));
                } catch {}
                return next;
              });
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setTreeWidth((prev) => {
                const current = prev ?? 380;
                const maxWidth = containerRef.current
                  ? Math.max(
                      260,
                      Math.min(
                        800,
                        containerRef.current.getBoundingClientRect().width - 380,
                      ),
                    )
                  : 800;
                const next = Math.min(maxWidth, current + 20);
                try {
                  localStorage.setItem("theseus_tree_width", String(next));
                } catch {}
                return next;
              });
            } else if (
              e.key === "Enter" ||
              e.key === " " ||
              e.key === "Escape"
            ) {
              e.preventDefault();
              handleResetWidth();
            }
          }}
          className={`hidden md:flex w-3 md:w-5 shrink-0 relative items-center justify-center cursor-col-resize select-none group z-10 ${
            isResizing ? "pointer-events-auto" : ""
          }`}
        >
          {/* Subtle Vertical Divider Line */}
          <div
            className={`absolute top-14 bottom-8 left-1/2 -translate-x-1/2 w-[1.5px] rounded-full transition-opacity duration-150 ${
              isResizing
                ? "bg-foreground/25 opacity-100"
                : "bg-border opacity-0 group-hover:opacity-100"
            }`}
          />

          {/* Redo / Reset Button (positioned just below the top rounded corner) */}
          <button
            type="button"
            onClick={handleResetWidth}
            onMouseDown={(e) => e.stopPropagation()}
            title="Reset pane size"
            aria-label="Reset pane size"
            className={`absolute top-8 left-1/2 -translate-x-1/2 p-0.5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all duration-150 cursor-pointer z-20 ${
              isResizing
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Pane: Main Note Editor Card */}
        <div
          data-editor-pane="true"
          onClickCapture={() => setActivePanel("editor")}
          onFocusCapture={() => setActivePanel("editor")}
          className={`flex-1 bg-card rounded-2xl md:rounded-[26px] border ${
            isResizing ? "transition-none" : "transition-all duration-200"
          } shadow-2xs flex flex-col overflow-hidden ${
            activePanel === "editor"
              ? "border-foreground/30 shadow-xs"
              : "border-border"
          } ${
            mobileTab === "editor" ? "flex" : "hidden md:flex"
          }`}
        >
          <NoteEditor
            selectedTopic={selectedTopic}
            onSaveNote={handleSaveNote}
            onUpdateStatus={handleUpdateStatus}
            onClose={() => {
              setSelectedTopicId("");
              setMobileTab("tree");
            }}
            courseTitle={syllabus.fileName}
            parentTitle={parentTopic?.title}
            onRenameTopic={handleRenameTopic}
            onBackToTree={() => setMobileTab("tree")}
            isActive={activePanel === "editor"}
            searchQuery={editorSearchQuery}
            onSearchChange={setEditorSearchQuery}
            onSearchMatchChange={setSearchMatchInfo}
            onRegisterSearchActions={(actions) => {
              searchActionsRef.current = actions;
            }}
          />
        </div>
      </div>

      {/* Full-screen invisible drag capture overlay while resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent" />
      )}

      {/* Website Footer: Status Chip, Subsections Interface, and Controls */}
      <footer className="border-t border-border-subtle bg-background flex flex-col shrink-0 z-20 font-manrope">
        {/* Expandable Sub-sections Drawer */}
        {isSubsectionsOpen && selectedTopic && (
          <SubsectionsDrawer
            selectedTopic={selectedTopic}
            onSaveNote={handleSaveNote}
            apiKey={apiKey}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            onClose={() => setIsSubsectionsOpen(false)}
          />
        )}

        {/* Bottom Bar: Status Chip (left), Mobile Tab Switcher (center), Sub-sections Trigger & Branding (right) */}
        <div className="px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          {/* Left Side: Status Chip */}
          <div className="flex items-center gap-2">
            <StatusChip items={syllabus.items} />
          </div>

          {/* Middle: Mobile View Switcher between Syllabus Tree and Note Editor */}
          <div className="flex md:hidden items-center p-0.5 bg-subtle rounded-full text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setMobileTab("tree");
                setActivePanel("tree");
              }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                mobileTab === "tree"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileTab("editor");
                setActivePanel("editor");
              }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                mobileTab === "editor"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Note
            </button>
          </div>

          {/* Right Side: Sub-sections Trigger Pill + Theseus label */}
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
                  ? `Sub-sections for "${selectedTopic.title}" (${selectedTopic.note?.subComments?.length || 0})`
                  : "Select a topic to view or add sub-sections"
              }
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>Sub-sections</span>
              {selectedTopic?.note?.subComments && selectedTopic.note.subComments.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-semibold ${
                    isSubsectionsOpen
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-subtle text-foreground-subtle"
                  }`}
                >
                  {selectedTopic.note.subComments.length}
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

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyUpdated={(key) => setApiKey(key)}
      />
    </main>
  );
}
