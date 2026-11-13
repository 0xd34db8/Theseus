import { SyllabusData, SyllabusItem, TopicStatus } from "@/types/syllabus";
import { stripModulePrefix } from "./syllabusUtils";

/**
 * Parses raw unformatted or pasted text into a hierarchical syllabus structure
 */
export function parseRawTextToSyllabus(
  text: string,
  title: string,
): SyllabusData {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: SyllabusItem[] = [];
  let currentUnit: SyllabusItem | null = null;
  let currentSection: SyllabusItem | null = null;

  lines.forEach((line, idx) => {
    const isUnit =
      /^unit\s+[0-9ivx]+/i.test(line) ||
      /^module\s+[0-9ivx]+/i.test(line) ||
      /^chapter\s+[0-9ivx]+/i.test(line);

    if (isUnit) {
      currentUnit = {
        id: `u-${Date.now()}-${idx}`,
        title: line,
        status: "untouched",
        hasNote: false,
        isExpanded: true,
        children: [],
      };
      items.push(currentUnit);
      currentSection = null;
    } else if (line.endsWith(":") || line.endsWith("{")) {
      const cleanTitle = line.replace(/[:{]+$/, "").trim();
      const section: SyllabusItem = {
        id: `sec-${Date.now()}-${idx}`,
        title: cleanTitle,
        status: "untouched",
        hasNote: false,
        isExpanded: true,
        children: [],
      };
      if (currentUnit) {
        currentUnit.children!.push(section);
        currentSection = section;
      } else {
        items.push(section);
        currentSection = section;
      }
    } else {
      const subtopic: SyllabusItem = {
        id: `top-${Date.now()}-${idx}`,
        title: line.replace(/^[-*•+]\s*/, "").trim(),
        status: "untouched",
        hasNote: false,
      };
      if (currentSection && currentSection.children) {
        currentSection.children.push(subtopic);
      } else if (currentUnit && currentUnit.children) {
        currentUnit.children.push(subtopic);
      } else {
        items.push(subtopic);
      }
    }
  });

  return {
    id: `syllabus-${Date.now()}`,
    fileName: title.trim() || "Untitled Syllabus",
    lastModified: "Just now",
    items:
      items.length > 0
        ? items
        : [
            {
              id: `u-1`,
              title: "UNIT I: Introduction",
              status: "untouched",
              hasNote: false,
              isExpanded: true,
              children: [
                {
                  id: "u-1-1",
                  title: "Overview & Foundations",
                  status: "untouched",
                  hasNote: false,
                },
              ],
            },
          ],
  };
}

/**
 * Creates a starter template syllabus for newly imported syllabi
 */
export function createStarterSyllabus(
  title: string = "New Syllabus",
): SyllabusData {
  return {
    id: `syllabus-${Date.now()}`,
    fileName: title.trim() || "New Syllabus",
    lastModified: "Just now",
    items: [],
    isDraft: true,
  };
}

function sanitizeJsonCandidate(str: string): string {
  if (!str) return "";
  let s = str.trim();

  // 1. Extract markdown code block if present
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(s)) !== null) {
    if (match[1]) {
      s = match[1].trim();
      break;
    }
  }

  // Handle unclosed markdown code fence (e.g. copied from start without closing fence)
  s = s.replace(/^`{3,}(?:json)?\s*/i, "").replace(/\s*`{3,}$/, "");

  // 2. Decode HTML entities that often get injected when copying from chat/web viewers
  s = s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x20;/g, " ");

  // 3. Remove single-line and multi-line comments outside of strings
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/(^|[^\\:])\/\/.*$/gm, "$1");

  // 4. Remove trailing backslashes before newlines (e.g. markdown line continuations)
  s = s.replace(/\\+(\r?\n)/g, "$1");

  // 5. Normalize curly/smart quotes to standard double/single quotes
  s = s
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // 6. Clean trailing commas before closing brackets and braces
  s = s.replace(/,(?:\s*,)*\s*([\]}])/g, "$1");

  return s;
}

function getItemTitle(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  if (typeof item === "object") {
    const candidate =
      item.title ||
      item.name ||
      item.topic ||
      item.unit ||
      item.module ||
      item.label ||
      item.text;
    if (typeof candidate === "string") return candidate.trim();
  }
  return "";
}

/**
 * Tries to parse generated LLM JSON or .theseus JSON from raw text or markdown code blocks.
 * Returns a valid SyllabusData object, or null if the content is not syllabus JSON.
 */
export function tryParseSyllabusJson(
  rawInput: string,
  fallbackTitle?: string,
): SyllabusData | null {
  if (!rawInput || typeof rawInput !== "string") return null;

  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const safeParse = (str: string): any => {
    try {
      return JSON.parse(str);
    } catch {
      try {
        const cleaned = str.replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    }
  };

  // 1. Direct parse attempt (preserves code blocks, comments, and quotes inside notes in valid .theseus files)
  let parsed: any = safeParse(trimmed);

  // 2. Extract markdown code block if present without destructive character replacements
  if (!parsed) {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      parsed = safeParse(codeBlockMatch[1].trim());
    }
  }

  // 3. Fallback to sanitized candidate for raw unformatted LLM outputs
  if (!parsed) {
    const cleaned = sanitizeJsonCandidate(trimmed);
    parsed = safeParse(cleaned);

    // Fallback: extract substring between first { and last } or first [ and last ]
    if (!parsed) {
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = safeParse(cleaned.substring(firstBrace, lastBrace + 1));
      }
    }

    if (!parsed) {
      const firstBracket = cleaned.indexOf("[");
      const lastBracket = cleaned.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        parsed = safeParse(cleaned.substring(firstBracket, lastBracket + 1));
      }
    }

    // Tolerant parsing fallback: repair unclosed brackets/quotes if standard parse failed
    if (!parsed) {
      const tolerantRes = tolerantParseSyllabus(cleaned);
      if (tolerantRes.items && tolerantRes.items.length > 0) {
        const detectedTitle =
          tolerantRes.courseTitle?.trim() ||
          fallbackTitle?.trim() ||
          tolerantRes.items[0]?.title ||
          "Course Syllabus";
        return {
          id: `syllabus-${Date.now()}`,
          fileName: detectedTitle,
          lastModified: "Just now",
          items: tolerantRes.items,
          isDraft: false,
        };
      }
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  // 4. Extract items and title supporting multiple LLM schemas
  let rawItems: any[] | null = null;
  let jsonTitle = "";

  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else if (Array.isArray(parsed.syllabus)) {
      rawItems = parsed.syllabus;
    } else if (parsed.syllabus && Array.isArray(parsed.syllabus.items)) {
      rawItems = parsed.syllabus.items;
    } else if (Array.isArray(parsed.units)) {
      rawItems = parsed.units;
    } else if (Array.isArray(parsed.modules)) {
      rawItems = parsed.modules;
    } else if (Array.isArray(parsed.topics)) {
      rawItems = parsed.topics;
    } else if (Array.isArray(parsed.sections)) {
      rawItems = parsed.sections;
    } else if (Array.isArray(parsed.curriculum)) {
      rawItems = parsed.curriculum;
    } else if (parsed.data && Array.isArray(parsed.data.items)) {
      rawItems = parsed.data.items;
    } else if (Array.isArray(parsed.data)) {
      rawItems = parsed.data;
    }

    jsonTitle =
      parsed.courseTitle ||
      parsed.fileName ||
      parsed.title ||
      parsed.name ||
      parsed.courseName ||
      parsed.course ||
      parsed.subject ||
      parsed.syllabus?.courseTitle ||
      parsed.syllabus?.fileName ||
      parsed.syllabus?.title ||
      parsed.data?.courseTitle ||
      parsed.data?.title ||
      "";
  }

  if (!rawItems || rawItems.length === 0) return null;

  // Verify that it actually looks like syllabus items (at least one item has a non-empty title/name)
  const isLikelySyllabus = rawItems.some((item) => getItemTitle(item).length > 0);
  if (!isLikelySyllabus) return null;

  let detectedTitle = jsonTitle.trim();

  // If JSON had no title, use fallbackTitle if it is not generic
  if (!detectedTitle && fallbackTitle && fallbackTitle.trim()) {
    const cleanFallback = fallbackTitle.trim();
    if (cleanFallback !== "New Syllabus" && cleanFallback !== "Imported Syllabus") {
      detectedTitle = cleanFallback;
    }
  }

  // If still no title and rawItems exist, derive from first item title
  if (!detectedTitle && rawItems.length > 0) {
    const firstTitle = getItemTitle(rawItems[0]);
    if (firstTitle) {
      detectedTitle = stripModulePrefix(firstTitle);
    }
  }

  // Recursive normalizer to build full SyllabusItem nodes
  function normalizeNode(node: any, prefix: string, index: number): SyllabusItem {
    const id =
      node && typeof node === "object" && node.id && typeof node.id === "string"
        ? node.id
        : `${prefix}-${index + 1}`;
    const rawTitle = getItemTitle(node);
    const title = rawTitle || `Topic ${index + 1}`;
    const status: TopicStatus =
      node && typeof node === "object" && ["done", "partial", "barely", "untouched"].includes(node.status)
        ? node.status
        : "untouched";
    const hasNote = Boolean(node && typeof node === "object" && (node.hasNote || node.note));
    const isExpanded =
      node && typeof node === "object" && node.isExpanded !== undefined
        ? Boolean(node.isExpanded)
        : true;

    const rawChildren =
      node && typeof node === "object"
        ? node.children || node.subtopics || node.subSections || node.sections || node.items
        : undefined;

    const children =
      Array.isArray(rawChildren) && rawChildren.length > 0
        ? rawChildren.map((child: any, cIdx: number) => normalizeNode(child, id, cIdx))
        : undefined;

    return {
      id,
      title,
      status,
      hasNote,
      note: node && typeof node === "object" ? node.note : undefined,
      isExpanded,
      children,
    };
  }

  const items = rawItems.map((item, idx) => normalizeNode(item, "u", idx));
  const finalTitle = detectedTitle.trim() || "Course Syllabus";

  return {
    id: parsed.id && typeof parsed.id === "string" ? parsed.id : `syllabus-${Date.now()}`,
    fileName: finalTitle,
    lastModified: "Just now",
    items,
    isDraft: false,
  };
}

/**
 * Detects whether raw input looks like an attempted JSON or .theseus file.
 * Returns 'theseus', 'json', or null if it appears to be plain unstructured text.
 */
export function detectAttemptedJsonOrTheseus(
  text: string,
): "theseus" | "json" | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Check for .theseus schema indicators
  const isTheseusLike =
    (trimmed.includes('"id"') &&
      (trimmed.includes('"syllabus-') || trimmed.includes('"lastModified"'))) ||
    (trimmed.includes('"fileName"') &&
      (trimmed.includes('"items"') || trimmed.includes('"lastModified"')));

  if (isTheseusLike) return "theseus";

  // 2. Check for JSON-like syntax indicators
  const isJsonLike =
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("```json") ||
    trimmed.startsWith("```") ||
    /```(?:json)?\s*[\{\[]/i.test(trimmed) ||
    (/"(?:courseTitle|items|units|modules|topics|syllabus|children)"\s*:/i.test(
      trimmed,
    ) &&
      (trimmed.includes("{") || trimmed.includes("[")));

  if (isJsonLike) return "json";

  return null;
}

/**
 * Serializes syllabus items to clean, human-readable JSON with 2-space indentation.
 * Omits internal UI states while preserving statuses, children, and optional courseTitle.
 */
export function serializeSyllabusToJson(
  items: SyllabusItem[],
  courseTitle?: string,
): string {
  function cleanItem(item: SyllabusItem): any {
    const clean: any = { title: item.title };
    if (item.status && item.status !== "untouched") {
      clean.status = item.status;
    }
    if (item.children && item.children.length > 0) {
      clean.children = item.children.map(cleanItem);
    }
    return clean;
  }

  const cleanedItems = items.map(cleanItem);

  if (courseTitle && courseTitle.trim()) {
    return JSON.stringify(
      {
        courseTitle: courseTitle.trim(),
        items: cleanedItems,
      },
      null,
      2,
    );
  }

  return JSON.stringify(cleanedItems, null, 2);
}

/**
 * Fault-tolerant JSON parser for syllabus editing.
 * Checks strict JSON validity. If invalid, repairs unclosed quotes/brackets, trailing commas,
 * and extracts syllabus items while marking isValid as false.
 * Matches existing items to preserve attached notes, statuses, and stable IDs.
 */
export function tolerantParseSyllabus(
  rawInput: string,
  existingItems: SyllabusItem[] = [],
): { items: SyllabusItem[] | null; isValid: boolean; courseTitle?: string } {
  if (!rawInput || typeof rawInput !== "string") {
    return { items: null, isValid: false };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { items: [], isValid: true };
  }

  let isValid = false;
  let rawData: any = null;

  // 1. Strict JSON parse
  try {
    rawData = JSON.parse(trimmed);
    isValid = true;
  } catch {
    isValid = false;
  }

  // 2. If not strictly valid, try sanitized + auto-repaired parse
  if (!isValid) {
    const cleaned = sanitizeJsonCandidate(trimmed);
    try {
      rawData = JSON.parse(cleaned);
    } catch {
      let s = cleaned;
      // remove trailing commas
      s = s.replace(/,\s*([\]}])/g, "$1");
      // insert commas between adjacent objects or arrays
      s = s.replace(/}\s*\{/g, "},{");
      s = s.replace(/]\s*\[/g, "],[");

      // Balance unclosed quotes and open bracket stack
      let inString = false;
      let escaped = false;
      const stack: string[] = [];

      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (c === "{") stack.push("}");
          else if (c === "[") stack.push("]");
          else if (c === "}" || c === "]") {
            if (stack.length > 0 && stack[stack.length - 1] === c) {
              stack.pop();
            }
          }
        }
      }

      if (inString) {
        s += '"';
      }

      s = s.replace(/,\s*$/, "");

      while (stack.length > 0) {
        s += stack.pop();
      }

      try {
        rawData = JSON.parse(s);
      } catch {
        // Fallback: extract any items by title
        rawData = extractFallbackTitles(cleaned);
      }
    }
  }

  // Extract rawItems array
  let rawItems: any[] | null = null;
  if (Array.isArray(rawData)) {
    rawItems = rawData;
  } else if (rawData && typeof rawData === "object") {
    if (Array.isArray(rawData.items)) {
      rawItems = rawData.items;
    } else if (rawData.syllabus && Array.isArray(rawData.syllabus.items)) {
      rawItems = rawData.syllabus.items;
    }
  }

  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    return { items: null, isValid };
  }

  // Build existing item lookup by ID, hierarchical path, and title
  const existingById = new Map<string, SyllabusItem>();
  const existingByPath = new Map<string, SyllabusItem>();
  const existingBySiblingTitle = new Map<string, SyllabusItem>();
  const existingByTitleList = new Map<string, SyllabusItem[]>();
  const usedIds = new Set<string>();

  function indexExisting(list: SyllabusItem[], parentPath: string = "") {
    list.forEach((it, idx) => {
      const currentPath = parentPath ? `${parentPath}.${idx}` : `${idx}`;
      if (it.id) existingById.set(it.id, it);
      existingByPath.set(currentPath, it);

      if (it.title) {
        const cleanTitle = it.title.trim().toLowerCase();
        existingBySiblingTitle.set(`${parentPath}:${cleanTitle}`, it);

        const group = existingByTitleList.get(cleanTitle) || [];
        group.push(it);
        existingByTitleList.set(cleanTitle, group);
      }

      if (it.children && it.children.length > 0) {
        indexExisting(it.children, currentPath);
      }
    });
  }
  indexExisting(existingItems);

  function normalizeItem(
    node: any,
    prefix: string,
    idx: number,
    parentPath: string = "",
  ): SyllabusItem {
    const currentPath = parentPath ? `${parentPath}.${idx}` : `${idx}`;
    const rawTitle =
      typeof node === "string"
        ? node
        : node && node.title
          ? String(node.title)
          : `Topic ${idx + 1}`;
    const title = rawTitle.trim() || `Topic ${idx + 1}`;
    const cleanTitle = title.toLowerCase();

    // 1. Direct ID match
    let matched: SyllabusItem | null = null;
    if (node && node.id && typeof node.id === "string" && existingById.has(node.id) && !usedIds.has(node.id)) {
      matched = existingById.get(node.id)!;
    }

    // 2. Exact structural path match
    if (!matched) {
      const candidateByPath = existingByPath.get(currentPath);
      if (candidateByPath && !usedIds.has(candidateByPath.id)) {
        // Path match: either same title or in-place topic rename at same structural position
        if (candidateByPath.title.trim().toLowerCase() === cleanTitle || !node.id) {
          matched = candidateByPath;
        }
      }
    }

    // 3. Sibling match within same parent unit
    if (!matched) {
      const siblingCandidate = existingBySiblingTitle.get(`${parentPath}:${cleanTitle}`);
      if (siblingCandidate && !usedIds.has(siblingCandidate.id)) {
        matched = siblingCandidate;
      }
    }

    // 4. Global fallback by title across tree (only unused items)
    if (!matched) {
      const candidates = existingByTitleList.get(cleanTitle);
      if (candidates) {
        for (const cand of candidates) {
          if (!usedIds.has(cand.id)) {
            matched = cand;
            break;
          }
        }
      }
    }

    if (matched) {
      usedIds.add(matched.id);
    }

    const id =
      matched
        ? matched.id
        : node && node.id && typeof node.id === "string" && !usedIds.has(node.id)
          ? (usedIds.add(node.id), node.id)
          : `${prefix}-${Date.now()}-${idx}`;

    const status: TopicStatus =
      node && ["done", "partial", "barely", "untouched"].includes(node.status)
        ? node.status
        : matched
          ? matched.status
          : "untouched";

    const note =
      node && node.note ? node.note : matched ? matched.note : undefined;

    const hasNote = Boolean(
      (node && (node.hasNote || node.note)) ||
        (matched && (matched.hasNote || matched.note)),
    );

    const isExpanded =
      node && node.isExpanded !== undefined
        ? Boolean(node.isExpanded)
        : matched
          ? matched.isExpanded
          : true;

    const children =
      Array.isArray(node.children) && node.children.length > 0
        ? node.children.map((c: any, cIdx: number) =>
            normalizeItem(c, id, cIdx, currentPath),
          )
        : undefined;

    return {
      id,
      title,
      status,
      note,
      hasNote,
      isExpanded,
      children,
    };
  }

  const items = rawItems.map((it, idx) => normalizeItem(it, "u", idx, ""));

  let detectedCourseTitle: string | undefined = undefined;
  if (!Array.isArray(rawData) && rawData && typeof rawData === "object") {
    const candidate =
      rawData.courseTitle ||
      rawData.fileName ||
      rawData.title ||
      rawData.name ||
      rawData.courseName ||
      rawData.subject;
    if (typeof candidate === "string" && candidate.trim()) {
      detectedCourseTitle = candidate.trim();
    }
  }

  return { items, isValid, courseTitle: detectedCourseTitle };
}

function extractFallbackTitles(text: string): any[] | null {
  const titleRegex = /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  const items: any[] = [];
  let match: RegExpExecArray | null;
  while ((match = titleRegex.exec(text)) !== null) {
    const title = match[1].replace(/\\"/g, '"').trim();
    if (title) {
      items.push({ title });
    }
  }
  return items.length > 0 ? items : null;
}


