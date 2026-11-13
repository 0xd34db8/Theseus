import { SyllabusData } from "@/types/syllabus";
import { LLMProvider, AIConfig } from "@/types/ai";
import { stripModulePrefix } from "./syllabusUtils";

const STORAGE_KEY = "theseus_syllabi_v1";
const ACTIVE_ID_KEY = "theseus_active_syllabus_id";
const AI_CONFIG_STORAGE = "theseus_ai_config";

export function detectProviderFromKey(key: string): LLMProvider {
  const trimmed = key.trim();
  if (trimmed.startsWith("AIza")) return "gemini";
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("sk-or-")) return "openrouter";
  if (trimmed.startsWith("gsk_")) return "groq";
  if (trimmed.startsWith("sk-")) return "openai";
  return "gemini";
}

export function getDefaultModelForProvider(provider: LLMProvider): string {
  switch (provider) {
    case "gemini":
      return "gemini-3.8-flash";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-haiku-20241022";
    case "openrouter":
      return "openai/gpt-4o-mini";
    case "groq":
      return "llama-3.3-70b-versatile";
    case "custom":
      return "gpt-4o-mini";
    default:
      return "gemini-3.8-flash";
  }
}

export function getAIConfig(): AIConfig {
  if (typeof window === "undefined") {
    return { provider: "gemini", apiKey: "", model: "gemini-3.8-flash" };
  }
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey !== undefined) return parsed;
    }
  } catch {}

  return {
    provider: "gemini",
    apiKey: "",
    model: getDefaultModelForProvider("gemini"),
  };
}

export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;
  const cleanConfig: AIConfig = {
    ...config,
    apiKey: config.apiKey.trim(),
    model: (config.model || getDefaultModelForProvider(config.provider)).trim(),
    baseURL: config.baseURL?.trim(),
  };
  localStorage.setItem(AI_CONFIG_STORAGE, JSON.stringify(cleanConfig));
}

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return getAIConfig().apiKey;
}

export function saveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  const provider = detectProviderFromKey(trimmed);
  saveAIConfig({
    provider,
    apiKey: trimmed,
    model: getDefaultModelForProvider(provider),
  });
}

export function removeApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AI_CONFIG_STORAGE);
}

function hasAnyNotesOrContent(syllabus: SyllabusData): boolean {
  if (!syllabus || !syllabus.items) return false;
  function checkItems(items: any[]): boolean {
    for (const item of items) {
      if (item.hasNote || (item.note && item.note.content?.trim())) return true;
      if (item.children && checkItems(item.children)) return true;
    }
    return false;
  }
  return checkItems(syllabus.items);
}

function shouldKeepSyllabus(s: SyllabusData): boolean {
  if (!s || !s.id) return false;
  // If the user has notes or written content anywhere in the syllabus, always keep it
  if (hasAnyNotesOrContent(s)) return true;
  // If not marked as draft and not an empty default syllabus, keep it
  if (
    !s.isDraft &&
    !(
      s.items?.length === 0 &&
      (s.fileName === "New Syllabus" || s.fileName === "Untitled Syllabus")
    )
  ) {
    return true;
  }
  // If it has items and a custom name, keep it
  if (
    s.items &&
    s.items.length > 0 &&
    s.fileName !== "New Syllabus" &&
    s.fileName !== "Untitled Syllabus"
  ) {
    return true;
  }
  // Untouched blank draft
  return false;
}

export function getSavedSyllabi(includeDrafts: boolean = false): SyllabusData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: SyllabusData[] = JSON.parse(raw);

    // Deduplicate any duplicate syllabus entries by ID
    const seen = new Set<string>();
    const deduplicated: SyllabusData[] = [];
    for (const s of parsed) {
      if (!s || !s.id) continue;
      if (!seen.has(s.id)) {
        seen.add(s.id);
        // Automatically fix "Imported Syllabus" if a real topic title is available
        const firstTopic = s.items?.[0]?.title || "";
        if (
          (s.fileName === "Imported Syllabus" || !s.fileName) &&
          s.items &&
          s.items.length > 0 &&
          firstTopic
        ) {
          const recovered = stripModulePrefix(firstTopic);
          s.fileName = recovered;
        }
        deduplicated.push(s);
      }
    }

    if (deduplicated.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
    }
    if (includeDrafts) {
      return deduplicated;
    }
    // Return only actual syllabi with user content/modifications, omitting untouched blank drafts
    return deduplicated.filter(shouldKeepSyllabus);
  } catch (e) {
    console.error("Failed to load syllabi from storage", e);
    return [];
  }
}

export function cleanupUnusedDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: SyllabusData[] = JSON.parse(raw);
    const cleaned = parsed.filter(shouldKeepSyllabus);
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {}
}

export function saveSyllabus(syllabus: SyllabusData): string {
  if (typeof window === "undefined") return syllabus.id;
  const list = getSavedSyllabi(true);

  const existingIdx = list.findIndex((s) => s.id === syllabus.id);

  let updatedList: SyllabusData[];
  const targetId = existingIdx >= 0 ? list[existingIdx].id : syllabus.id;
  const updatedItem: SyllabusData = {
    ...syllabus,
    id: targetId,
    lastModified: "Just now",
  };

  if (existingIdx >= 0) {
    const remaining = list.filter((_, idx) => idx !== existingIdx);
    updatedList = [updatedItem, ...remaining];
  } else {
    updatedList = [updatedItem, ...list];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    localStorage.setItem(ACTIVE_ID_KEY, targetId);
  } catch (err) {
    console.warn("Failed to write syllabi to localStorage (quota may be exceeded):", err);
    try {
      // Emergency recovery: attempt to save only the active syllabus
      localStorage.setItem(STORAGE_KEY, JSON.stringify([updatedItem]));
      localStorage.setItem(ACTIVE_ID_KEY, targetId);
    } catch (criticalErr) {
      console.error("Critical: localStorage quota completely exhausted.", criticalErr);
    }
  }
  return targetId;
}

export function getActiveSyllabusId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ID_KEY) || null;
}

export function setActiveSyllabusId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_ID_KEY, id);
}

export function deleteSyllabus(id: string): SyllabusData[] {
  if (typeof window === "undefined") return [];
  const list = getSavedSyllabi().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function restoreSyllabus(
  syllabus: SyllabusData,
  atIndex?: number,
): SyllabusData[] {
  if (typeof window === "undefined") return [];
  const list = getSavedSyllabi();
  const existingIdx = list.findIndex((s) => s.id === syllabus.id);
  if (existingIdx >= 0) return list;

  const updatedList = [...list];
  const targetIndex =
    typeof atIndex === "number"
      ? Math.min(Math.max(0, atIndex), updatedList.length)
      : 0;
  updatedList.splice(targetIndex, 0, syllabus);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  return updatedList;
}


