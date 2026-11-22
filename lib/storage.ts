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

export interface SaveSyllabusResult {
  id: string;
  saved: boolean;
  error?: "quota" | "storage";
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014
  );
}

export function saveAIConfig(config: AIConfig): boolean {
  if (typeof window === "undefined") return false;
  const cleanConfig: AIConfig = {
    ...config,
    apiKey: config.apiKey.trim(),
    model: (config.model || getDefaultModelForProvider(config.provider)).trim(),
    baseURL: config.baseURL?.trim(),
  };
  try {
    localStorage.setItem(AI_CONFIG_STORAGE, JSON.stringify(cleanConfig));
    return true;
  } catch (err) {
    console.error("Failed to save AI config to localStorage:", err);
    return false;
  }
}

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return getAIConfig().apiKey;
}

export function saveApiKey(key: string): boolean {
  if (typeof window === "undefined") return false;
  const trimmed = key.trim();
  const provider = detectProviderFromKey(trimmed);
  return saveAIConfig({
    provider,
    apiKey: trimmed,
    model: getDefaultModelForProvider(provider),
  });
}

export function removeApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AI_CONFIG_STORAGE);
  } catch (err) {
    console.error("Failed to remove AI config from localStorage:", err);
  }
}

function hasAnyNotesOrContent(syllabus: SyllabusData): boolean {
  if (!syllabus || !Array.isArray(syllabus.items)) return false;
  function checkItems(items: any[]): boolean {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      if (
        item.hasNote ||
        (item.note &&
          typeof item.note.content === "string" &&
          item.note.content.trim())
      ) {
        return true;
      }
      if (Array.isArray(item.children) && checkItems(item.children)) {
        return true;
      }
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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
      } catch (writeErr) {
        console.warn("Failed to persist deduplicated syllabi list:", writeErr);
      }
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
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const cleaned = (parsed as SyllabusData[]).filter(shouldKeepSyllabus);
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {}
}

export function saveSyllabus(syllabus: SyllabusData): SaveSyllabusResult {
  if (typeof window === "undefined") {
    return { id: syllabus.id, saved: true };
  }
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
    return { id: targetId, saved: true };
  } catch (err) {
    const isQuota = isQuotaExceededError(err);
    console.error(
      isQuota
        ? "Failed to write syllabi to localStorage: quota exceeded."
        : "Failed to write syllabi to localStorage:",
      err,
    );
    return {
      id: targetId,
      saved: false,
      error: isQuota ? "quota" : "storage",
    };
  }
}

export function getActiveSyllabusId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveSyllabusId(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
    return true;
  } catch (err) {
    console.error("Failed to persist active syllabus ID:", err);
    return false;
  }
}

export function deleteSyllabus(id: string): SyllabusData[] {
  if (typeof window === "undefined") return [];
  const list = getSavedSyllabi().filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to update syllabi list after delete:", err);
  }
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Failed to restore syllabus to localStorage:", err);
  }
  return updatedList;
}


