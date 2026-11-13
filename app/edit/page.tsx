"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "@/components/editor/TopBar";
import { SyllabusTree } from "@/components/editor/SyllabusTree";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { EditorFooter } from "@/components/editor/EditorFooter";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { RotateCcw } from "lucide-react";
import {
  getSavedSyllabi,
  saveSyllabus,
  getActiveSyllabusId,
  getApiKey,
  cleanupUnusedDrafts,
} from "@/lib/storage";
import {
  initialSyllabusData,
  buildTopicNote,
  findItemById,
  findParentItem,
  updateItemInTree,
  deleteItemFromTree,
  addItemToTree,
  exportSyllabusAsFile,
} from "@/lib/syllabusUtils";
import { useTreeHistory } from "@/hooks/useTreeHistory";
import { useResizablePane } from "@/hooks/useResizablePane";
import {
  SyllabusData,
  SyllabusItem,
  TopicNote,
  TopicStatus,
} from "@/types/syllabus";

export default function EditPage() {
  const [syllabus, setSyllabus] = useState<SyllabusData>(initialSyllabusData);
  const syllabusRef = useRef<SyllabusData>(syllabus);
  syllabusRef.current = syllabus;
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const activeEditorFlushRef = useRef<(() => void) | null>(null);
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

  const {
    treeWidth,
    isResizing,
    containerRef,
    treePaneRef,
    handleResizeStart,
    handleResetWidth,
    nudgeWidth,
  } = useResizablePane();

  const applyRestoredItems = useCallback((restoredItems: SyllabusItem[]) => {
    setSyllabus((prev) => {
      const updated = { ...prev, isDraft: false, items: restoredItems };
      syllabusRef.current = updated;
      saveSyllabus(updated);
      return updated;
    });
  }, []);

  const {
    canUndo,
    canRedo,
    pushTreeHistory,
    undo: undoTree,
    redo: redoTree,
  } = useTreeHistory(applyRestoredItems);

  const handleTreeUndo = useCallback(() => {
    undoTree(syllabusRef.current.items);
  }, [undoTree]);

  const handleTreeRedo = useCallback(() => {
    redoTree(syllabusRef.current.items);
  }, [redoTree]);

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

        const selector =
          targetPanel === "tree"
            ? '[data-tree-search-input="true"]'
            : '[data-editor-search-input="true"]';
        const input = document.querySelector<HTMLInputElement>(selector);
        if (input) {
          input.focus();
          input.select();
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

      // If clicked/focused on editor, let editor handle its own undo/redo natively.
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
  }, [activePanel, handleTreeUndo, handleTreeRedo]);

  // Load active syllabus and api key on client
  useEffect(() => {
    const list = getSavedSyllabi(true);
    const activeId = getActiveSyllabusId();
    const active =
      (activeId ? list.find((s) => s.id === activeId) : null) ||
      list[0] ||
      initialSyllabusData;
    setSyllabus(active);
    syllabusRef.current = active;
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

  // Export as .theseus on Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (activeEditorFlushRef.current) {
          activeEditorFlushRef.current();
        }
        exportSyllabusAsFile(syllabusRef.current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      syllabusRef.current = updated;
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
      syllabusRef.current = updated;
      saveSyllabus(updated);
      return updated;
    });
  };

  // Save note for topic
  const handleSaveNote = useCallback((topicId: string, note: TopicNote) => {
    const current = syllabusRef.current;
    const updated = {
      ...current,
      isDraft: false,
      items: updateItemInTree(current.items, topicId, (item) => ({
        ...item,
        hasNote: true,
        note: {
          ...item.note,
          ...note,
          content: note.content !== undefined ? note.content : (item.note?.content || ""),
          subComments: note.subComments !== undefined ? note.subComments : item.note?.subComments,
        },
      })),
    };
    syllabusRef.current = updated;
    setSyllabus(updated);
    saveSyllabus(updated);
  }, []);

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
              ? buildTopicNote(item, {
                  content: `### ${item.title}\n\nStart writing notes here...`,
                })
              : undefined,
          };
        }),
      };
      syllabusRef.current = updated;
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleFileNameChange = (name: string) => {
    setSyllabus((prev) => {
      const updated = { ...prev, isDraft: false, fileName: name };
      syllabusRef.current = updated;
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
      syllabusRef.current = updated;
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
      syllabusRef.current = updated;
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
      syllabusRef.current = updated;
      saveSyllabus(updated);
      return updated;
    });
  };

  const handleExport = () => {
    if (activeEditorFlushRef.current) {
      activeEditorFlushRef.current();
    }
    exportSyllabusAsFile(syllabusRef.current);
  };

  const handleUpdateItems = (newItems: SyllabusItem[]) => {
    setSyllabus((prev) => {
      pushTreeHistory(prev.items);
      const updated = {
        ...prev,
        isDraft: false,
        items: newItems,
      };
      syllabusRef.current = updated;
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
        onHomeClick={() => activeEditorFlushRef.current?.()}
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
              if (activeEditorFlushRef.current) {
                activeEditorFlushRef.current();
              }
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
            canUndo={canUndo}
            canRedo={canRedo}
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
              nudgeWidth(-20);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              nudgeWidth(20);
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
            key={selectedTopic?.id || "empty"}
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
            onRegisterFlush={(flush) => {
              activeEditorFlushRef.current = flush;
            }}
          />
        </div>
      </div>

      {/* Full-screen invisible drag capture overlay while resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent" />
      )}

      {/* Editor Footer */}
      <EditorFooter
        items={syllabus.items}
        selectedTopic={selectedTopic}
        mobileTab={mobileTab}
        onSelectMobileTab={(tab) => {
          setMobileTab(tab);
          setActivePanel(tab);
        }}
        onSaveNote={handleSaveNote}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyUpdated={(key) => setApiKey(key)}
      />
    </main>
  );
}
