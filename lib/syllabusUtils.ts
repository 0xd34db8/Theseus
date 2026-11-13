import {
  SyllabusData,
  SyllabusItem,
  TopicNote,
  TopicStatus,
} from "@/types/syllabus";

export const initialSyllabusData: SyllabusData = {
  id: "syllabus-blank",
  fileName: "Untitled Syllabus",
  lastModified: "Just now",
  items: [],
};

export interface TopicStatusMeta {
  value: TopicStatus;
  label: string;
  pillClassName: string;
  optionClassName: string;
}

export const TOPIC_STATUS_META: Record<TopicStatus, TopicStatusMeta> = {
  done: {
    value: "done",
    label: "Done",
    pillClassName:
      "bg-status-done-bg border-status-done-border text-status-done-fg",
    optionClassName: "hover:bg-status-done-bg text-status-done-fg font-medium",
  },
  partial: {
    value: "partial",
    label: "Partially",
    pillClassName:
      "bg-status-partial-bg border-status-partial-border text-status-partial-fg",
    optionClassName:
      "hover:bg-status-partial-bg text-status-partial-fg font-medium",
  },
  barely: {
    value: "barely",
    label: "Barely",
    pillClassName:
      "bg-status-barely-bg border-status-barely-border text-status-barely-fg",
    optionClassName:
      "hover:bg-status-barely-bg text-status-barely-fg font-medium",
  },
  untouched: {
    value: "untouched",
    label: "Untouched",
    pillClassName: "bg-subtle border-border text-foreground-subtle",
    optionClassName: "hover:bg-subtle text-foreground-subtle",
  },
};

export const TOPIC_STATUS_ORDER: TopicStatus[] = [
  "untouched",
  "barely",
  "partial",
  "done",
];

/**
 * Formats the current local time for note timestamps.
 */
export function formatNoteTimestamp(includeSeconds = true): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  });
}

/**
 * Builds a complete TopicNote while preserving existing metadata.
 */
export function buildTopicNote(
  topic: Pick<SyllabusItem, "id" | "title" | "note">,
  overrides: Partial<TopicNote> = {},
): TopicNote {
  return {
    id: topic.note?.id || `note-${topic.id}`,
    title: topic.title,
    content: topic.note?.content || "",
    subComments: topic.note?.subComments,
    updatedAt: formatNoteTimestamp(true),
    ...overrides,
  };
}

/**
 * Strips leading Unit/Module/Chapter/CO numbering prefixes from a heading title.
 */
export function stripModulePrefix(title: string): string {
  return (
    title
      .replace(/^(?:unit|module|chapter|co)\s*[\divx]+[:\-–]\s*/i, "")
      .trim() || title
  );
}

export interface SyllabusStats {
  total: number;
  done: { count: number; pct: number };
  partial: { count: number; pct: number };
  barely: { count: number; pct: number };
  untouched: { count: number; pct: number };
}

/**
 * Calculates completion stats across all topics in a syllabus.
 * Top-level modules and parent topics are counted, and their status
 * cascades down to untouched child topics so marking a module has a major contribution.
 */
export function calculateSyllabusStats(items: SyllabusItem[]): SyllabusStats {
  let done = 0;
  let partial = 0;
  let barely = 0;
  let untouched = 0;
  let total = 0;

  const countNode = (status: TopicStatus) => {
    total++;
    if (status === "done") done++;
    else if (status === "partial") partial++;
    else if (status === "barely") barely++;
    else untouched++;
  };

  const traverse = (node: SyllabusItem, inheritedStatus?: TopicStatus) => {
    const effectiveStatus =
      node.status !== "untouched"
        ? node.status
        : inheritedStatus || "untouched";

    countNode(effectiveStatus);

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child, effectiveStatus);
      }
    }
  };

  for (const item of items) {
    traverse(item, item.status);
  }

  if (total === 0) {
    return {
      total: 0,
      done: { count: 0, pct: 0 },
      partial: { count: 0, pct: 0 },
      barely: { count: 0, pct: 0 },
      untouched: { count: 0, pct: 0 },
    };
  }

  return {
    total,
    done: { count: done, pct: Math.round((done / total) * 100) },
    partial: { count: partial, pct: Math.round((partial / total) * 100) },
    barely: { count: barely, pct: Math.round((barely / total) * 100) },
    untouched: { count: untouched, pct: Math.round((untouched / total) * 100) },
  };
}

/**
 * Recursively searches for an item in the syllabus tree by ID
 */
export function findItemById(
  items: SyllabusItem[],
  id: string,
): SyllabusItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively searches for the direct parent of an item in the syllabus tree by ID
 */
export function findParentItem(
  items: SyllabusItem[],
  childId: string,
  currentParent: SyllabusItem | null = null,
): SyllabusItem | null {
  for (const item of items) {
    if (item.id === childId) {
      return currentParent;
    }
    if (item.children && item.children.length > 0) {
      const found = findParentItem(item.children, childId, item);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Recursively updates an item in the syllabus tree immutably
 */
export function updateItemInTree(
  items: SyllabusItem[],
  id: string,
  updater: (item: SyllabusItem) => SyllabusItem,
): SyllabusItem[] {
  return items.map((item) => {
    if (item.id === id) {
      return updater(item);
    }
    if (item.children) {
      return {
        ...item,
        children: updateItemInTree(item.children, id, updater),
      };
    }
    return item;
  });
}

/**
 * Recursively deletes an item from the syllabus tree by ID
 */
export function deleteItemFromTree(
  items: SyllabusItem[],
  id: string,
): SyllabusItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: deleteItemFromTree(item.children, id),
        };
      }
      return item;
    });
}

/**
 * Adds an item to the syllabus tree immutably
 */
export function addItemToTree(
  items: SyllabusItem[],
  parentId: string | null,
  newItem: SyllabusItem,
): SyllabusItem[] {
  if (!parentId) {
    return [...items, newItem];
  }

  return items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        isExpanded: true,
        children: [...(item.children || []), newItem],
      };
    }
    if (item.children) {
      return {
        ...item,
        children: addItemToTree(item.children, parentId, newItem),
      };
    }
    return item;
  });
}

/**
 * Exports syllabus data to a local .theseus file.
 * Uses native showSaveFilePicker dialog when available to prompt user,
 * and falls back to browser file download.
 */
export async function exportSyllabusAsFile(
  syllabus: SyllabusData,
): Promise<void> {
  if (typeof window === "undefined") return;

  const safeTitle = (syllabus.fileName || "syllabus")
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .replace(/\s+/g, "_");
  const fileName = `${safeTitle}.theseus`;
  const dataStr = JSON.stringify(syllabus, null, 2);

  // Modern browser File System Access API: prompts native Save File dialog
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "Theseus Syllabus File (*.theseus)",
            accept: {
              "application/json": [".theseus", ".json"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(dataStr);
      await writable.close();
      return;
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User explicitly cancelled the file picker dialog
        return;
      }
      // If error occurs or not allowed, continue to fallback
    }
  }

  // Fallback download trigger
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

