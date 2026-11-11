"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SyllabusItem,
  TopicNote,
  NoteComment,
  TopicStatus,
} from "@/types/syllabus";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { getApiKey } from "@/lib/storage";
import { generateNotesWithAI, getNoteGenerationPrompt } from "@/lib/ai";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Edit3,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  AlertCircle,
  MessageSquare,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ImageIcon,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import {
  CustomImage,
  CustomUnderline,
  CustomHighlight,
  CustomFontSize,
  CustomShortcuts,
  CustomTaskList,
  CustomTaskItem,
  CustomCodeBlock,
  FootnoteReference,
  FootnoteDefinition,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  MathNode,
  Superscript,
  DefinitionList,
  DefinitionTerm,
  DefinitionDescription,
  MarkdownPlugins,
  getEditorMarkdown,
  SearchHighlight,
  SearchHighlightPluginKey,
} from "./extensions";
import { EditorToolbar } from "./EditorToolbar";

const STATUS_OPTIONS: {
  value: TopicStatus;
  label: string;
  className: string;
}[] = [
  {
    value: "untouched",
    label: "Untouched",
    className: "hover:bg-subtle text-foreground-subtle",
  },
  {
    value: "barely",
    label: "Barely",
    className: "hover:bg-status-barely-bg text-status-barely-fg font-medium",
  },
  {
    value: "partial",
    label: "Partially",
    className: "hover:bg-status-partial-bg text-status-partial-fg font-medium",
  },
  {
    value: "done",
    label: "Done",
    className: "hover:bg-status-done-bg text-status-done-fg font-medium",
  },
];

interface NoteEditorProps {
  selectedTopic: SyllabusItem | null;
  onSaveNote: (topicId: string, note: TopicNote) => void;
  onUpdateStatus: (topicId: string, status: TopicStatus) => void;
  onClose: () => void;
  courseTitle?: string;
  parentTitle?: string;
  onRenameTopic?: (topicId: string, newTitle: string) => void;
  onBackToTree?: () => void;
  isActive?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchMatchChange?: (
    info: { current: number; total: number } | null,
  ) => void;
  onRegisterSearchActions?: (actions: {
    findNext: () => void;
    findPrev: () => void;
  }) => void;
  onRegisterFlush?: (flush: () => void) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  selectedTopic,
  onSaveNote,
  onUpdateStatus,
  onClose,
  courseTitle,
  parentTitle,
  onRenameTopic,
  onBackToTree,
  isActive = false,
  searchQuery,
  onSearchChange,
  onSearchMatchChange,
  onRegisterSearchActions,
  onRegisterFlush,
}) => {
  const [content, setContent] = useState<string>("");
  const [hasCopiedNotePrompt, setHasCopiedNotePrompt] =
    useState<boolean>(false);

  // Topic Inline Renaming
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleValue, setTitleValue] = useState<string>("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Notion-style Image URL Embed Pill
  const [pendingEmbedUrl, setPendingEmbedUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState<boolean>(false);
  const [isFullscreenSearchOpen, setIsFullscreenSearchOpen] =
    useState<boolean>(false);
  const [localSearchMatchInfo, setLocalSearchMatchInfo] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fullscreenSearchInputRef = useRef<HTMLInputElement>(null);

  // Status Dropdown State
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] =
    useState<boolean>(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStatusDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setIsStatusDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusDropdownOpen]);

  useEffect(() => {
    setIsStatusDropdownOpen(false);
  }, [selectedTopic?.id]);

  // Fullscreen toggle & Escape key listener
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (!next) {
        setIsFullscreenSearchOpen(false);
      }
      return next;
    });
  };

  const toggleReadingMode = () => {
    setIsReadingMode((prev) => !prev);
  };

  // Stable references for autosave without closure lag
  const selectedTopicRef = useRef(selectedTopic);
  selectedTopicRef.current = selectedTopic;

  const onSaveNoteRef = useRef(onSaveNote);
  onSaveNoteRef.current = onSaveNote;

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticUpdateRef = useRef<boolean>(false);
  const latestMarkdownRef = useRef<string>(selectedTopic?.note?.content || "");
  const isDirtyRef = useRef<boolean>(false);

  // Synchronous flush of any pending autosave changes
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const topic = selectedTopicRef.current;
    if (!topic || !topic.hasNote || !isDirtyRef.current) return;

    isDirtyRef.current = false;
    const updatedNote: TopicNote = {
      id: topic.note?.id || `note-${topic.id}`,
      title: topic.title,
      content: latestMarkdownRef.current,
      subComments: topic.note?.subComments,
      updatedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    onSaveNoteRef.current(topic.id, updatedNote);
  }, []);

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      flushSaveRef.current();
    };
  }, []);

  // Flush pending changes if the browser window or tab is closed/navigated
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSaveRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Clear debounce timer and dirty state if a note is toggled off externally
  useEffect(() => {
    if (selectedTopic && !selectedTopic.hasNote) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      isDirtyRef.current = false;
    }
  }, [selectedTopic?.hasNote]);

  // Expose flush handler to parent (EditPage) for save-before-export, save-before-switch, and save-before-home
  useEffect(() => {
    onRegisterFlush?.(() => {
      flushSaveRef.current();
    });
  }, [onRegisterFlush]);

  const handleClose = () => {
    flushSaveRef.current();
    setIsFullscreen(false);
    setIsFullscreenSearchOpen(false);
    setIsReadingMode(false);
    onClose();
  };

  // Keyboard shortcut listener for Fullscreen Ctrl+F / Cmd+F and Escape
  useEffect(() => {
    if (!isFullscreen) {
      setIsFullscreenSearchOpen(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F: Reveal and focus editor search bar in fullscreen
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        e.stopPropagation();
        setIsFullscreenSearchOpen(true);
        setTimeout(() => {
          fullscreenSearchInputRef.current?.focus();
          fullscreenSearchInputRef.current?.select();
        }, 30);
        return;
      }

      // Escape key: close search bar first if open; otherwise exit fullscreen
      if (e.key === "Escape") {
        if (isFullscreenSearchOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsFullscreenSearchOpen(false);
          onSearchChange?.("");
          return;
        }
        e.preventDefault();
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, isFullscreenSearchOpen, onSearchChange]);

  // AI Generation State
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  const debounceSave = (updatedMarkdown: string) => {
    latestMarkdownRef.current = updatedMarkdown;
    isDirtyRef.current = true;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // Only autosave for an active topic that already has a note
    const currentTopic = selectedTopicRef.current;
    if (!currentTopic || !currentTopic.hasNote) return;
    const targetTopicId = currentTopic.id;

    saveTimerRef.current = setTimeout(() => {
      // Guard against topic change or topic having no note while debouncing
      if (
        !selectedTopicRef.current ||
        selectedTopicRef.current.id !== targetTopicId ||
        !selectedTopicRef.current.hasNote
      ) {
        return;
      }

      isDirtyRef.current = false;
      const topic = selectedTopicRef.current;
      const updatedNote: TopicNote = {
        id: topic.note?.id || `note-${topic.id}`,
        title: topic.title,
        content: updatedMarkdown,
        subComments: topic.note?.subComments,
        updatedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      onSaveNoteRef.current(topic.id, updatedNote);
    }, 350);
  };

  // TipTap Rich Live Markdown Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
        codeBlock: false,
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomCodeBlock,
      FootnoteReference,
      FootnoteDefinition,
      CustomUnderline,
      CustomFontSize,
      CustomTaskList,
      CustomTaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "theseus-editor-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      MathNode,
      Superscript,
      DefinitionList,
      DefinitionTerm,
      DefinitionDescription,
      MarkdownPlugins,
      CustomHighlight.configure({
        multicolor: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "image"],
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder:
          "Start writing notes, or use markdown shortcuts (# for heading, - for list, [ ] for todo)...",
      }),
      CustomShortcuts,
      SearchHighlight,
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: selectedTopic?.note?.content || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose max-w-none focus:outline-hidden min-h-[350px] text-sm leading-relaxed text-foreground",
      },
      handleDOMEvents: {
        blur: () => {
          flushSaveRef.current();
          return false;
        },
      },
      handlePaste: (view, event) => {
        // 1. Direct image paste from clipboard via Ctrl+V
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (src) {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }

        // 2. Notion-style image URL embed detection
        const pastedText = event.clipboardData?.getData("text/plain")?.trim();
        if (
          pastedText &&
          /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(
            pastedText,
          )
        ) {
          setPendingEmbedUrl(pastedText);
        }

        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (src) {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isProgrammaticUpdateRef.current) return;
      const markdown = getEditorMarkdown(ed);
      latestMarkdownRef.current = markdown;
      isDirtyRef.current = true;
      setContent(markdown);
      debounceSave(markdown);
    },
  });

  // Synchronize reading mode with TipTap editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadingMode);
  }, [isReadingMode, editor]);

  // Handle editor-scoped Undo/Redo shortcuts when this panel is active/highlighted
  useEffect(() => {
    if (!isActive || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isUndo =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey;
      const isRedo =
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey);

      if (!isUndo && !isRedo) return;

      const target = e.target as HTMLElement | null;
      // If typing in another normal input/textarea inside the editor (like comment inputs), let native input undo handle it
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      // If TipTap editor is already focused, TipTap's own ProseMirror keydown listener will handle it natively
      if (editor.isFocused) {
        return;
      }

      // Otherwise (user clicked editor pane toolbar, comments, or outer card), route to TipTap history
      e.preventDefault();
      e.stopPropagation();
      if (isUndo && editor.can().undo()) {
        editor.chain().focus().undo().run();
      } else if (isRedo && editor.can().redo()) {
        editor.chain().focus().redo().run();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, editor]);

  // Synchronize search query with TipTap search highlighting
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    queueMicrotask(() => {
      if (!editor.isDestroyed) {
        editor.commands.setSearchTerm(searchQuery || "");
      }
    });
  }, [searchQuery, editor, selectedTopic?.id]);

  // Synchronize match count and active index with parent and local state
  useEffect(() => {
    if (!editor || editor.isDestroyed || !selectedTopic?.hasNote) {
      if (searchQuery && searchQuery.trim()) {
        const info = { current: 0, total: 0 };
        setLocalSearchMatchInfo(info);
        onSearchMatchChange?.(info);
      } else {
        setLocalSearchMatchInfo(null);
        onSearchMatchChange?.(null);
      }
      return;
    }

    if (searchQuery && searchQuery.trim()) {
      const pluginState = SearchHighlightPluginKey.getState(editor.state);
      if (pluginState && pluginState.matches.length > 0) {
        const info = {
          current: pluginState.currentIndex + 1,
          total: pluginState.matches.length,
        };
        setLocalSearchMatchInfo(info);
        onSearchMatchChange?.(info);
      } else {
        const info = { current: 0, total: 0 };
        setLocalSearchMatchInfo(info);
        onSearchMatchChange?.(info);
      }
    } else {
      setLocalSearchMatchInfo(null);
      onSearchMatchChange?.(null);
    }
  }, [
    searchQuery,
    editor,
    editor?.state,
    selectedTopic?.id,
    selectedTopic?.hasNote,
    onSearchMatchChange,
  ]);

  // Register search actions for next/previous match navigation
  useEffect(() => {
    if (!editor || !onRegisterSearchActions) return;
    onRegisterSearchActions({
      findNext: () => {
        if (!editor.isDestroyed) {
          editor.commands.nextSearchMatch();
        }
      },
      findPrev: () => {
        if (!editor.isDestroyed) {
          editor.commands.prevSearchMatch();
        }
      },
    });
  }, [editor, onRegisterSearchActions]);

  // Auto-scroll active match into view
  useEffect(() => {
    if (!searchQuery?.trim()) return;
    const timeout = setTimeout(() => {
      const activeEl = editor?.view?.dom?.querySelector(
        ".editor-search-match-active",
      );
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 40);
    return () => clearTimeout(timeout);
  }, [searchQuery, editor?.state]);

  // Sync state and editor content when selected topic changes
  useEffect(() => {
    if (selectedTopic) {
      setTitleValue(selectedTopic.title);
      setIsEditingTitle(false);
      const noteContent = selectedTopic.note?.content || "";
      if (!isDirtyRef.current) {
        latestMarkdownRef.current = noteContent;
        setContent(noteContent);
        if (editor) {
          const currentMd = getEditorMarkdown(editor);
          if (currentMd !== noteContent) {
            isProgrammaticUpdateRef.current = true;
            editor.commands.setContent(noteContent, { emitUpdate: false });
            latestMarkdownRef.current = noteContent;
            setTimeout(() => {
              isProgrammaticUpdateRef.current = false;
            }, 0);
          }
        }
      }
    } else {
      setContent("");
      latestMarkdownRef.current = "";
      isDirtyRef.current = false;
      if (editor) {
        isProgrammaticUpdateRef.current = true;
        editor.commands.setContent("", { emitUpdate: false });
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 0);
      }
    }
    setAiError(null);
    setPendingEmbedUrl(null);
  }, [selectedTopic?.id, selectedTopic?.note?.content, editor]);

  // Keep titleValue in sync if topic title changes externally (e.g. tree undo/redo or tree rename)
  useEffect(() => {
    if (selectedTopic && !isEditingTitle) {
      setTitleValue(selectedTopic.title);
    }
  }, [selectedTopic?.title, isEditingTitle]);

  // Handle topic inline renaming
  const handleSaveTitle = () => {
    const trimmed = titleValue.trim();
    if (selectedTopic && trimmed && trimmed !== selectedTopic.title) {
      onRenameTopic?.(selectedTopic.id, trimmed);
    } else if (selectedTopic) {
      setTitleValue(selectedTopic.title);
    }
    setIsEditingTitle(false);
  };

  // Immediate save helper for AI note generation
  const handleAutoSave = (updatedContent: string) => {
    const topic = selectedTopicRef.current;
    if (!topic) return;
    latestMarkdownRef.current = updatedContent;
    isDirtyRef.current = false;
    const updatedNote: TopicNote = {
      id: topic.note?.id || `note-${topic.id}`,
      title: topic.title,
      content: updatedContent,
      subComments: topic.note?.subComments,
      updatedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    onSaveNoteRef.current(topic.id, updatedNote);
  };

  // Copy note prompt for external LLM interfaces (ChatGPT, Claude, Gemini, etc.)
  const handleCopyNotePrompt = async () => {
    if (!selectedTopic) return;
    const prompt = getNoteGenerationPrompt({
      topicTitle: selectedTopic.title,
      parentTitle: parentTitle,
      courseTitle: courseTitle,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setHasCopiedNotePrompt(true);
      setTimeout(() => setHasCopiedNotePrompt(false), 2500);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  // Generate complete notes using configured AI
  const handleAiGenerateNotes = async () => {
    if (!selectedTopic) return;
    const key = getApiKey();
    if (!key) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsAiGenerating(true);
    setAiError(null);

    try {
      const generated = await generateNotesWithAI(
        {
          topicTitle: selectedTopic.title,
          parentTitle: parentTitle,
          courseTitle: courseTitle,
        },
        key,
      );

      setContent(generated);
      latestMarkdownRef.current = generated;
      isDirtyRef.current = false;
      if (editor) {
        isProgrammaticUpdateRef.current = true;
        editor.commands.setContent(generated, { emitUpdate: false });
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 0);
      }
      handleAutoSave(generated);
    } catch (err: any) {
      setAiError(err.message || "Failed to generate notes with AI.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Convert detected image URL to embedded image block
  const handleEmbedPendingUrl = () => {
    if (!editor || !pendingEmbedUrl) return;
    editor.chain().focus().setImage({ src: pendingEmbedUrl }).run();
    setPendingEmbedUrl(null);
  };

  if (!selectedTopic) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-muted-foreground select-none font-manrope">
        <div className="w-16 h-16 rounded-full bg-subtle flex items-center justify-center mb-4 text-muted-foreground">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-light text-foreground-subtle mb-1">
          Select a topic
        </h3>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Click on any topic in the syllabus tree to view or start taking
          structured notes.
        </p>
      </div>
    );
  }

  // Handle "no notes yet" state
  if (!selectedTopic.hasNote) {
    return (
      <div className="h-full flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 font-manrope">
        <div className="w-full flex justify-between items-center text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            {onBackToTree && (
              <button
                type="button"
                onClick={onBackToTree}
                className="md:hidden flex items-center gap-1 px-2 py-1 text-xs text-foreground-subtle hover:text-foreground rounded-md hover:bg-subtle transition-colors cursor-pointer"
                title="Back to Topics"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Tree</span>
              </button>
            )}
            <span className="font-mono text-[11px] uppercase tracking-wider">
              {selectedTopic.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-subtle rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Centered Topic Title: Click to rename inline */}
        <div className="text-center my-auto space-y-5 max-w-md w-full">
          {isEditingTitle ? (
            <div className="w-full">
              <input
                ref={titleInputRef}
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  else if (e.key === "Escape") {
                    setTitleValue(selectedTopic.title);
                    setIsEditingTitle(false);
                  }
                }}
                onBlur={handleSaveTitle}
                autoFocus
                className="text-2xl md:text-3xl font-light text-foreground tracking-tight text-center bg-transparent border-b-2 border-accent focus:outline-hidden px-2 py-0.5 w-full font-manrope"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleValue(selectedTopic.title);
                setIsEditingTitle(true);
              }}
              className="group inline-flex items-center justify-center gap-2 px-3 py-1 rounded-xl hover:bg-subtle transition-colors cursor-pointer text-center max-w-full"
              title="Click to rename topic"
            >
              <h2 className="text-2xl md:text-3xl font-light text-foreground tracking-tight truncate">
                {selectedTopic.title}
              </h2>
              <Edit3 className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}

          <div className="space-y-4">
            <p className="text-sm font-light text-muted-foreground italic">
              no notes yet
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  const newNote: TopicNote = {
                    id: `note-${selectedTopic.id}`,
                    title: selectedTopic.title,
                    content: `### ${selectedTopic.title}\n\nStart writing notes, formulas, or insert diagrams here...`,
                    updatedAt: new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }),
                  };
                  latestMarkdownRef.current = newNote.content;
                  isDirtyRef.current = false;
                  onSaveNote(selectedTopic.id, newNote);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-full text-xs font-medium shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Note</span>
              </button>

              {/* Two-in-one button: Generate with AI + Copy Prompt */}
              <div className="inline-flex items-center rounded-full bg-linear-to-r from-green-600 to-emerald-600 text-white shadow-xs transition-all overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={handleAiGenerateNotes}
                  disabled={isAiGenerating}
                  className="inline-flex items-center gap-2 pl-4 pr-3 py-2 hover:bg-black/10 transition-colors cursor-pointer disabled:opacity-60"
                  title="Generate study notes with AI"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Notes...</span>
                    </>
                  ) : (
                    <span>Generate with AI</span>
                  )}
                </button>
                <div className="w-px h-4 bg-white/25" />
                <button
                  type="button"
                  onClick={handleCopyNotePrompt}
                  className="inline-flex items-center justify-center px-3 py-2 hover:bg-black/10 transition-colors cursor-pointer"
                  title={
                    hasCopiedNotePrompt
                      ? "Prompt Copied"
                      : "Copy note prompt for external LLM"
                  }
                >
                  {hasCopiedNotePrompt ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </div>
            </div>

            {aiError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span>{aiError}</span>
                  <div>
                    <button
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="text-xs font-medium text-red-500 underline"
                    >
                      Configure API Key
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full" />

        <ApiKeyModal
          isOpen={isApiKeyModalOpen}
          onClose={() => setIsApiKeyModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div
      data-editor-pane="true"
      className={`flex flex-col font-manrope transition-all duration-200 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-card h-screen w-screen overflow-hidden"
          : "h-full overflow-hidden"
      }`}
    >
      {/* Top Header: Centered Clickable / Inline Editable Topic Title */}
      <div className="relative pt-4 sm:pt-5 pb-3 sm:pb-4 px-3 sm:px-6 md:px-8 border-b border-border-subtle flex items-center justify-between gap-2">
        {/* Left: Mobile Back Button + Status Selector Pill */}
        <div className="flex items-center  sm:gap-2 min-w-0 z-10">
          {onBackToTree && (
            <button
              type="button"
              onClick={onBackToTree}
              className="md:hidden flex items-center gap-1 px-2 py-1 text-xs text-foreground-subtle hover:text-foreground rounded-lg hover:bg-subtle transition-colors cursor-pointer"
              title="Back to Topics"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline text-[11px] font-medium">
                Tree
              </span>
            </button>
          )}

          <span className="hidden sm:inline text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Status:
          </span>
          <div
            ref={statusDropdownRef}
            className="relative inline-flex items-center"
          >
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium py-1 pl-2.5 pr-2 rounded-full border outline-hidden cursor-pointer transition-colors ${
                selectedTopic.status === "done"
                  ? "bg-status-done-bg border-status-done-border text-status-done-fg"
                  : selectedTopic.status === "partial"
                    ? "bg-status-partial-bg border-status-partial-border text-status-partial-fg"
                    : selectedTopic.status === "barely"
                      ? "bg-status-barely-bg border-status-barely-border text-status-barely-fg"
                      : "bg-subtle border-border text-foreground-subtle"
              }`}
              title="Change status"
              aria-expanded={isStatusDropdownOpen}
              aria-haspopup="listbox"
            >
              <span>
                {selectedTopic.status === "done"
                  ? "Done"
                  : selectedTopic.status === "partial"
                    ? "Partially"
                    : selectedTopic.status === "barely"
                      ? "Barely"
                      : "Untouched"}
              </span>
              <ChevronDown
                className={`w-3 h-3 opacity-60 text-current shrink-0 transition-transform duration-150 ${
                  isStatusDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isStatusDropdownOpen && (
              <div
                role="listbox"
                aria-label="Topic status"
                className="absolute left-0 top-full mt-1.5 w-36 bg-card rounded-xl border border-border py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
              >
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedTopic.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onUpdateStatus(selectedTopic.id, opt.value);
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between cursor-pointer transition-colors ${opt.className}`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Centered Topic Title: Click to Rename inline */}
        {isEditingTitle ? (
          <div className="absolute left-1/2 -translate-x-1/2 max-w-[50%] xs:max-w-[55%] w-full flex items-center justify-center z-10">
            <input
              ref={titleInputRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                else if (e.key === "Escape") {
                  setTitleValue(selectedTopic.title);
                  setIsEditingTitle(false);
                }
              }}
              onBlur={handleSaveTitle}
              autoFocus
              className="text-lg sm:text-2xl font-light text-foreground tracking-tight text-center bg-transparent border-b-2 border-accent focus:outline-hidden px-2 py-0.5 w-full font-manrope"
            />
          </div>
        ) : (
          <div className="absolute left-1/2 -translate-x-1/2 max-w-[36%] xs:max-w-[42%] sm:max-w-[50%] flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setTitleValue(selectedTopic.title);
                setIsEditingTitle(true);
              }}
              className="group flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-xl hover:bg-subtle transition-colors cursor-pointer max-w-full"
              title="Click to rename topic"
            >
              <h2 className="text-base sm:text-xl md:text-2xl font-light text-foreground tracking-tight truncate">
                {selectedTopic.title}
              </h2>
              <Edit3 className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" />
            </button>
          </div>
        )}

        {/* Right Actions: AI Notes + Reading Mode + Fullscreen & Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 z-10 shrink-0">
          {/* Fullscreen Search Bar: Kept hidden until Ctrl+F / Cmd+F is pressed */}
          {isFullscreen && isFullscreenSearchOpen && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-card border border-border rounded-full shadow-xs transition-all animate-in fade-in zoom-in-95 duration-150">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={fullscreenSearchInputRef}
                type="text"
                value={searchQuery || ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) {
                      editor?.commands.prevSearchMatch();
                    } else {
                      editor?.commands.nextSearchMatch();
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsFullscreenSearchOpen(false);
                    onSearchChange?.("");
                  }
                }}
                placeholder="Find in note..."
                aria-label="Find in note"
                className="w-32 xs:w-40 sm:w-48 lg:w-56 text-xs bg-transparent text-foreground placeholder-muted-foreground outline-hidden font-manrope"
              />

              {searchQuery ? (
                <div className="flex items-center gap-0.5 shrink-0">
                  {localSearchMatchInfo && (
                    <span className="text-[10px] text-muted-foreground font-mono select-none px-1">
                      {localSearchMatchInfo.total > 0
                        ? `${localSearchMatchInfo.current}/${localSearchMatchInfo.total}`
                        : "0/0"}
                    </span>
                  )}
                  {localSearchMatchInfo && localSearchMatchInfo.total > 1 && (
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => editor?.commands.prevSearchMatch()}
                        className="p-0.5 text-muted-foreground hover:text-foreground rounded-xs hover:bg-subtle cursor-pointer"
                        title="Previous match (Shift+Enter)"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editor?.commands.nextSearchMatch()}
                        className="p-0.5 text-muted-foreground hover:text-foreground rounded-xs hover:bg-subtle cursor-pointer"
                        title="Next match (Enter)"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSearchChange?.("")}
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-subtle cursor-pointer transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setIsFullscreenSearchOpen(false);
                  onSearchChange?.("");
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-subtle cursor-pointer ml-0.5 shrink-0"
                title="Close search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* AI Notes Button: Hidden in Reading Mode */}
          {!isReadingMode && (
            <div className="inline-flex items-center rounded-full bg-linear-to-r from-green-600 to-emerald-600 text-white shadow-2xs hover:shadow-2xs transition-all overflow-hidden text-xs font-medium whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={handleAiGenerateNotes}
                disabled={isAiGenerating}
                className="flex items-center gap-1.5 pl-3 pr-2.5 py-1 hover:bg-black/10 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Generate comprehensive study notes with AI"
              >
                {isAiGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                    <span className="hidden xs:inline">Generating...</span>
                  </>
                ) : (
                  <span className="whitespace-nowrap">AI Notes</span>
                )}
              </button>
              <div className="w-px h-3.5 bg-white/25 shrink-0" />
              <button
                type="button"
                onClick={handleCopyNotePrompt}
                className="flex items-center justify-center px-2 py-1 hover:bg-black/10 transition-colors cursor-pointer shrink-0"
                title={
                  hasCopiedNotePrompt
                    ? "Prompt Copied"
                    : "Copy study note prompt"
                }
              >
                {hasCopiedNotePrompt ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          )}

          {/* Reading Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleReadingMode}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${
              isReadingMode
                ? "bg-accent/20 text-accent hover:bg-accent/30"
                : "text-muted-foreground hover:text-foreground hover:bg-subtle"
            }`}
            title={isReadingMode ? "Exit reading mode" : "Reading mode"}
            aria-label={isReadingMode ? "Exit reading mode" : "Reading mode"}
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Close Note Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title="Close Note"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Formatting Toolbar (Ribbon) with Slide-Up Transition */}
      {!isReadingMode && (
        <div
          className={`transition-all duration-200 ease-in-out overflow-hidden ${
            isRibbonCollapsed
              ? "max-h-0 opacity-0 pointer-events-none"
              : "max-h-48 opacity-100 border-b border-border-subtle"
          }`}
        >
          <EditorToolbar
            editor={editor}
            onSlideUp={() => setIsRibbonCollapsed(true)}
          />
        </div>
      )}

      {/* Re-expand ribbon handle when slid up */}
      {!isReadingMode && isRibbonCollapsed && (
        <div className="flex items-center justify-end px-3 sm:px-6 md:px-8 py-1 bg-subtle/50 border-b border-border-subtle text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            type="button"
            onClick={() => setIsRibbonCollapsed(false)}
            className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-foreground hover:bg-subtle rounded-full transition-colors cursor-pointer select-none"
            title="Show ribbon"
            aria-label="Show ribbon"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Notion-style Floating Contextual Action for Pasted Image URLs */}
      {!isReadingMode && pendingEmbedUrl && (
        <div className="mx-3 sm:mx-6 md:mx-8 my-2 p-2 sm:p-2.5 rounded-xl bg-accent-subtle border border-accent/30 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-foreground-subtle truncate max-w-[200px] sm:max-w-[280px]">
              Image URL:{" "}
              <span className="font-mono text-foreground">
                {pendingEmbedUrl}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEmbedPendingUrl}
              className="px-2.5 sm:px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-2xs cursor-pointer"
            >
              Embed Image
            </button>
            <button
              type="button"
              onClick={() => setPendingEmbedUrl(null)}
              className="px-2 sm:px-2.5 py-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
            >
              Keep as link
            </button>
          </div>
        </div>
      )}

      {/* AI Error Notification Banner */}
      {aiError && (
        <div className="px-4 sm:px-6 md:px-8 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between text-xs text-red-500">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{aiError}</span>
          </div>
          <button
            onClick={() => setAiError(null)}
            className="p-1 text-red-500 hover:text-red-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Notion-Style Live Markdown Editing / Reading Canvas */}
      <div
        className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 min-h-0 ${
          isReadingMode ? "cursor-default theseus-reading-mode" : "cursor-text"
        }`}
        onClick={(e) => {
          if (isReadingMode) {
            const target = (e.target as HTMLElement).closest("a");
            if (target && target.href) {
              const href = target.getAttribute("href");
              if (href?.startsWith("#")) {
                const id = href.slice(1);
                const el = document.getElementById(id);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                }
              } else {
                window.open(target.href, "_blank", "noopener,noreferrer");
              }
            }
            return;
          }
          if (editor && !editor.isFocused) {
            editor.commands.focus();
          }
        }}
      >
        <div
          className={
            isReadingMode
              ? "max-w-3xl mx-auto w-full py-2 sm:py-4"
              : isFullscreen
                ? "max-w-4xl mx-auto w-full"
                : "w-full"
          }
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
};
