"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { RecentFileCard } from "@/components/home/RecentFileCard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  getSavedSyllabi,
  saveSyllabus,
  setActiveSyllabusId,
  deleteSyllabus,
  restoreSyllabus,
  getApiKey,
  getAIConfig,
  cleanupUnusedDrafts,
} from "@/lib/storage";
import {
  parseRawTextToSyllabus,
  createStarterSyllabus,
  tryParseSyllabusJson,
} from "@/lib/parser";
import { formatSyllabusWithAI, getSyllabusTreePrompt } from "@/lib/ai";
import { processSyllabusFile } from "@/lib/fileUtils";
import { SyllabusData } from "@/types/syllabus";
import {
  Upload,
  ArrowRight,
  BookOpen,
  Key,
  Loader2,
  AlertCircle,
  FileText,
  Copy,
  Check,
  Undo2,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<SyllabusData[]>([]);
  const [syllabusName, setSyllabusName] = useState("");
  const [rawText, setRawText] = useState("");
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hasCopiedTreePrompt, setHasCopiedTreePrompt] = useState(false);
  const [coreSyllabusOnly, setCoreSyllabusOnly] = useState(true);
  const [isOpeningSyllabus, setIsOpeningSyllabus] = useState(false);
  const isProcessingPasteRef = useRef(false);

  // Undo deletion state
  const [lastDeletedSyllabus, setLastDeletedSyllabus] = useState<{
    file: SyllabusData;
    index: number;
  } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // AI & Processing state
  const [isFormatting, setIsFormatting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for loading progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isFormatting) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFormatting]);

  // Compute smooth progress percentage based on elapsed seconds
  const progressPct = isFormatting
    ? Math.min(15 + Math.floor(Math.log(elapsedSeconds + 1) * 28), 95)
    : 0;

  // API Key management
  const [apiKey, setApiKey] = useState<string>("");
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  useEffect(() => {
    cleanupUnusedDrafts();
    setSyllabi(getSavedSyllabi());
    setApiKey(getApiKey());
  }, []);

  // Process pasted text: parses syllabus JSON, saves it, and opens the editor
  const processPastedText = (text: string): boolean => {
    if (!text || typeof text !== "string" || isProcessingPasteRef.current)
      return false;
    const syllabusData = tryParseSyllabusJson(text, syllabusName);
    if (syllabusData) {
      isProcessingPasteRef.current = true;
      setIsOpeningSyllabus(true);
      saveSyllabus(syllabusData);
      setActiveSyllabusId(syllabusData.id);
      router.push("/edit");
      return true;
    }
    return false;
  };

  // Universal paste detector: works anywhere on the homepage via Cmd+V (macOS) / Ctrl+V (Windows)
  // as well as native browser paste events, even when no text box or input is focused
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.focus();
    }

    let lastPasteTimestamp = 0;

    const handlePasteEvent = (e: ClipboardEvent) => {
      if (isProcessingPasteRef.current) return;
      const now = Date.now();
      if (now - lastPasteTimestamp < 1000) return;
      lastPasteTimestamp = now;

      const pastedText = e.clipboardData?.getData("text") || "";
      if (pastedText && processPastedText(pastedText)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isProcessingPasteRef.current) return;
      const isPasteShortcut =
        (e.metaKey || e.ctrlKey) &&
        (e.key?.toLowerCase() === "v" || e.code === "KeyV");

      if (!isPasteShortcut) return;

      setTimeout(async () => {
        if (isProcessingPasteRef.current) return;
        const now = Date.now();
        if (now - lastPasteTimestamp < 1000) return;

        if (
          navigator.clipboard &&
          typeof navigator.clipboard.readText === "function"
        ) {
          try {
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText && !isProcessingPasteRef.current) {
              lastPasteTimestamp = Date.now();
              processPastedText(clipboardText);
            }
          } catch {}
        }
      }, 50);
    };

    window.addEventListener("paste", handlePasteEvent, true);
    window.addEventListener("keydown", handleGlobalKeyDown, true);

    return () => {
      window.removeEventListener("paste", handlePasteEvent, true);
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [syllabusName, router]);

  const handleCopyTreePrompt = async () => {
    const prompt = getSyllabusTreePrompt({
      rawText: activeTab === "text" && rawText.trim() ? rawText : undefined,
      coreOnly: coreSyllabusOnly,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setHasCopiedTreePrompt(true);
      setTimeout(() => setHasCopiedTreePrompt(false), 2500);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  const handleOpenSyllabus = (id: string) => {
    setIsOpeningSyllabus(true);
    setActiveSyllabusId(id);
    router.push("/edit");
  };

  const handleDeleteSyllabus = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const fileIndex = syllabi.findIndex((s) => s.id === id);
    const deletedFile = syllabi.find((s) => s.id === id);
    if (deletedFile) {
      setLastDeletedSyllabus({
        file: deletedFile,
        index: fileIndex >= 0 ? fileIndex : 0,
      });
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      undoTimerRef.current = setTimeout(() => {
        setLastDeletedSyllabus(null);
      }, 10000);
    }
    const updated = deleteSyllabus(id);
    setSyllabi(updated);
  };

  const handleUndoDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lastDeletedSyllabus) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    const updated = restoreSyllabus(
      lastDeletedSyllabus.file,
      lastDeletedSyllabus.index,
    );
    setSyllabi(updated);
    setLastDeletedSyllabus(null);
  };

  const handleSelectedFile = async (file: File) => {
    setUploadedFile(file);
    setErrorMessage(null);

    const cleanName = file.name.replace(/\.[^/.]+$/, "");

    // Check if the uploaded file is JSON or .theseus format and open immediately
    try {
      const text = await file.text();
      const parsedSyllabus = tryParseSyllabusJson(
        text,
        syllabusName || cleanName,
      );
      if (parsedSyllabus) {
        setIsOpeningSyllabus(true);
        saveSyllabus(parsedSyllabus);
        setActiveSyllabusId(parsedSyllabus.id);
        router.push("/edit");
        return;
      }
    } catch {}

    if (!syllabusName) {
      setSyllabusName(cleanName);
    }
  };

  const handleImport = async (useAi = true) => {
    setErrorMessage(null);

    const title =
      syllabusName.trim() ||
      uploadedFile?.name.replace(/\.[^/.]+$/, "") ||
      "New Syllabus";

    // Direct check: if rawText is valid generated JSON, immediately open it without extra processing
    if (activeTab === "text" && rawText.trim()) {
      const directJson = tryParseSyllabusJson(rawText.trim(), title);
      if (directJson) {
        setIsOpeningSyllabus(true);
        saveSyllabus(directJson);
        setActiveSyllabusId(directJson.id);
        router.push("/edit");
        return;
      }
    }

    // 1. If using AI but no API key configured, prompt user to enter one
    if (useAi && !apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsFormatting(true);
    setStatusMessage(
      useAi ? "Formatting syllabus with AI..." : "Parsing syllabus locally...",
    );

    try {
      let resultSyllabus: SyllabusData;

      if (!useAi) {
        // Offline mode: does not require a file/text to be provided first
        if (activeTab === "file" && uploadedFile) {
          setStatusMessage("Reading file contents...");
          const processed = await processSyllabusFile(uploadedFile);
          if (processed.isJsonOrTheseus && processed.jsonData) {
            resultSyllabus = {
              ...processed.jsonData,
              fileName: title,
              lastModified: "Just now",
            };
          } else if (processed.text) {
            resultSyllabus = parseRawTextToSyllabus(processed.text, title);
          } else {
            resultSyllabus = createStarterSyllabus(title);
            resultSyllabus.isDraft = true;
          }
        } else if (activeTab === "text" && rawText.trim()) {
          resultSyllabus = parseRawTextToSyllabus(rawText.trim(), title);
        } else {
          // No file or text provided: seamlessly create a blank syllabus marked as draft
          resultSyllabus = createStarterSyllabus(title);
          resultSyllabus.isDraft = true;
        }
      } else {
        // AI Formatting mode: requires input to format
        if (activeTab === "file") {
          if (!uploadedFile) {
            throw new Error(
              "Please select or drop a syllabus file first to format with AI.",
            );
          }

          setStatusMessage("Reading file contents...");
          const processed = await processSyllabusFile(uploadedFile);

          if (processed.isJsonOrTheseus && processed.jsonData) {
            resultSyllabus = {
              ...processed.jsonData,
              fileName: title,
              lastModified: "Just now",
            };
          } else {
            setStatusMessage("AI is structuring syllabus tree...");
            if (processed.pdfBase64) {
              resultSyllabus = await formatSyllabusWithAI(
                {
                  fileData: {
                    base64: processed.pdfBase64,
                    mimeType: "application/pdf",
                  },
                  preferredTitle: title,
                  coreOnly: coreSyllabusOnly,
                },
                getAIConfig(),
              );
            } else if (processed.text) {
              resultSyllabus = await formatSyllabusWithAI(
                {
                  text: processed.text,
                  preferredTitle: title,
                  coreOnly: coreSyllabusOnly,
                },
                getAIConfig(),
              );
            } else {
              throw new Error("Could not extract readable content from file.");
            }
          }
        } else {
          // Tab: Paste Text
          if (!rawText.trim()) {
            throw new Error("Please paste syllabus text to format with AI.");
          }

          setStatusMessage("AI is structuring syllabus topics...");
          resultSyllabus = await formatSyllabusWithAI(
            {
              text: rawText.trim(),
              preferredTitle: title,
              coreOnly: coreSyllabusOnly,
            },
            getAIConfig(),
          );
        }
      }

      // Save and navigate to editor
      saveSyllabus(resultSyllabus);
      setActiveSyllabusId(resultSyllabus.id);
      router.push("/edit");
    } catch (err: any) {
      setErrorMessage(
        err.message || "An unexpected error occurred while parsing syllabus.",
      );
    } finally {
      setIsFormatting(false);
      setStatusMessage("");
    }
  };

  // Header actions slot: Theme Toggle + API Key button
  const headerActions = (
    <div className="flex items-center gap-2.5">
      <ThemeToggle />
      <button
        type="button"
        onClick={() => setIsApiKeyModalOpen(true)}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-normal transition-all cursor-pointer font-manrope ${
          apiKey
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
            : "bg-card border-border text-foreground-subtle hover:border-border shadow-2xs hover:bg-subtle"
        }`}
        title="Configure API Key"
      >
        <Key className="w-3.5 h-3.5 text-foreground-subtle" />
        <span>{apiKey ? "API Key Configured" : "Configure API Key"}</span>
      </button>
    </div>
  );

  return (
    <main className="min-h-screen lg:h-screen w-full bg-background flex flex-col overflow-y-auto lg:overflow-hidden font-manrope">
      {/* Unified Window Header */}
      <AppHeader actions={headerActions} />

      {/* Main Content Layout: Split Panes (Import & Recents) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 px-4 sm:px-6 md:px-8 py-4 sm:py-5 min-h-0 lg:overflow-hidden">
        {/* Left Column: Import New Syllabus */}
        <div className="lg:col-span-5 xl:col-span-5 bg-card rounded-2xl md:rounded-[26px] border border-border shadow-xs p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-light text-foreground tracking-tight">
                  PDF, Word (.docx) or .TXT supported
                </h2>
              </div>
            </div>

            {/* Title input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Syllabus Title
              </label>
              <input
                type="text"
                value={syllabusName}
                onChange={(e) => setSyllabusName(e.target.value)}
                placeholder="e.g. Machine Learning, Cloud Architecture"
                className="w-full px-4 py-2.5 bg-subtle border border-border rounded-2xl text-xs text-foreground placeholder-muted-foreground outline-none focus:border-accent focus:bg-card transition-all font-manrope"
              />
            </div>

            {/* Tab selector and Copy Prompt */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-2 p-1 bg-subtle rounded-xl text-xs flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("file");
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    activeTab === "file"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("text");
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    activeTab === "text"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Paste Text
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyTreePrompt}
                title="Copy prompt to attach syllabus and generate tree JSON in ChatGPT, Claude, Gemini, etc."
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-subtle hover:bg-card text-foreground-subtle rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
              >
                {hasCopiedTreePrompt ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* Upload Drop Zone or Text Area */}
            {activeTab === "file" ? (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleSelectedFile(file);
                }}
                className={`flex flex-col items-center justify-center p-7 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  dragOver
                    ? "border-accent bg-accent-subtle"
                    : uploadedFile
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-border hover:border-border-subtle bg-subtle"
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.theseus,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSelectedFile(file);
                  }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-card shadow-xs flex items-center justify-center text-foreground-subtle mb-3 border border-border">
                  {uploadedFile ? (
                    <FileText className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Upload className="w-5 h-5 text-foreground-subtle" />
                  )}
                </div>
                <span className="text-xs font-medium text-foreground text-center truncate max-w-[260px]">
                  {uploadedFile
                    ? uploadedFile.name
                    : "Click or drag & drop syllabus file"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Supports PDF, Word (.docx), TXT, or .theseus (paste JSON
                  anywhere to open)
                </span>
              </label>
            ) : (
              <div className="space-y-1">
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    setErrorMessage(null);
                  }}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData?.getData("text") || "";
                    if (pastedText && processPastedText(pastedText)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Paste unformatted syllabus text or generated JSON here (pasting JSON will automatically open it):&#10;&#10;UNIT I: Introduction to Machine Learning&#10;Types of Learning: Supervised, Unsupervised, Reinforcement&#10;Theory of Generalization: Generalization bound, VC Dimension&#10;Decision Trees, Neural Networks, Ensemble Learning"
                  className="w-full p-3.5 bg-subtle border border-border rounded-2xl text-xs font-mono text-foreground placeholder-muted-foreground outline-none focus:border-accent focus:bg-card resize-none transition-all leading-relaxed"
                />
              </div>
            )}

            {/* Core Syllabus Only Checkbox */}
            <div className="flex items-center pt-0.5">
              <label
                className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground group"
                title="Excludes non-core sections like lab experiments, learning outcomes, and grading schemes."
              >
                <input
                  type="checkbox"
                  checked={coreSyllabusOnly}
                  onChange={(e) => setCoreSyllabusOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border text-foreground focus:ring-0 focus:ring-offset-0 cursor-pointer accent-accent"
                />
                <span className="font-normal text-foreground-subtle group-hover:text-foreground transition-colors">
                  Core Syllabus Only
                </span>
              </label>
            </div>

            {/* Error Message Notice */}
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>{errorMessage}</p>
                  {!apiKey && (
                    <button
                      type="button"
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="text-xs font-medium text-red-500 underline cursor-pointer"
                    >
                      Configure your API key now
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4 mt-4 border-t border-border-subtle space-y-3">
            {/* Loading Progress Bar */}
            {isFormatting && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-subtle border border-border animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs text-foreground-subtle">
                  <span className="font-medium truncate max-w-[200px]">
                    {elapsedSeconds > 18
                      ? "Finalizing syllabus topics..."
                      : elapsedSeconds > 8
                        ? "AI is structuring syllabus tree..."
                        : statusMessage || "Processing syllabus..."}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {elapsedSeconds}s
                  </span>
                </div>
                <div className="w-full bg-border/40 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isFormatting}
              onClick={() => handleImport(true)}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground rounded-2xl text-xs font-medium tracking-tight shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer font-manrope disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isFormatting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                  <span>
                    {statusMessage || "Processing syllabus..."} (
                    {elapsedSeconds}s)
                  </span>
                </>
              ) : (
                <>
                  <span>Format & Open in Editor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {/* Offline editing button: always accessible even when API key is configured */}
            <button
              type="button"
              disabled={isFormatting}
              onClick={() => handleImport(false)}
              className="w-full py-2.5 bg-subtle hover:bg-card text-foreground-subtle rounded-2xl text-xs font-normal transition-all cursor-pointer font-manrope disabled:opacity-60"
            >
              Start editing offline (without AI)
            </button>
          </div>
        </div>

        {/* Right Column: Recently Worked on Files */}
        <div className="lg:col-span-7 xl:col-span-7 bg-card rounded-2xl md:rounded-[26px] border border-border shadow-xs p-5 sm:p-6 flex flex-col min-h-[300px] lg:min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-xl font-light text-foreground tracking-tight">
                Recent Files
              </h2>
            </div>

            <div className="flex items-center gap-2.5">
              {lastDeletedSyllabus && (
                <button
                  type="button"
                  onClick={handleUndoDelete}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-accent hover:opacity-80 bg-accent-subtle border border-accent/30 rounded-lg transition-all cursor-pointer font-medium shadow-2xs animate-in fade-in zoom-in-95 duration-150 font-manrope"
                  title={`Undo remove "${lastDeletedSyllabus.file.fileName}"`}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}

              <span className="text-xs font-mono text-muted-foreground">
                {syllabi.length} files
              </span>
            </div>
          </div>

          {/* List of Recent Files */}
          <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
            {syllabi.map((file) => (
              <RecentFileCard
                key={file.id}
                file={file}
                onOpen={handleOpenSyllabus}
                onDelete={handleDeleteSyllabus}
              />
            ))}

            {syllabi.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <BookOpen className="w-10 h-10 mb-2 stroke-1 text-muted-foreground opacity-60" />
                <p className="text-sm">No recent files yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reusable API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyUpdated={(key) => setApiKey(key)}
      />

      {/* Fullscreen loading overlay with shadow layering when opening or pasting syllabus */}
      {isOpeningSyllabus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
          <div className="flex flex-col items-center justify-center p-8 bg-card/95 rounded-3xl shadow-2xl border border-border ring-1 ring-border">
            <Loader2 className="w-12 h-12 animate-spin text-foreground" />
          </div>
        </div>
      )}
    </main>
  );
}
