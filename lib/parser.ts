import { SyllabusData, SyllabusItem, TopicStatus } from "@/types/syllabus";

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

  // 2. Decode HTML entities that often get injected when copying from chat/web viewers
  s = s
    .replace(/&#x20;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // 3. Remove trailing backslashes before newlines (e.g. markdown line continuations)
  s = s.replace(/\\+(\r?\n)/g, "$1");

  // 4. Normalize curly/smart quotes to standard double/single quotes
  s = s
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // 5. Clean trailing commas before closing brackets and braces
  s = s.replace(/,\s*([\]}])/g, "$1");

  return s;
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

  const cleaned = sanitizeJsonCandidate(trimmed);
  let parsed: any = safeParse(cleaned);

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

  if (!parsed || typeof parsed !== "object") return null;

  // 4. Extract items and title
  let rawItems: any[] | null = null;
  let jsonTitle = "";

  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else if (parsed.syllabus && Array.isArray(parsed.syllabus.items)) {
      rawItems = parsed.syllabus.items;
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
      "";
  }

  if (!rawItems || rawItems.length === 0) return null;

  // Verify that it actually looks like syllabus items (at least one object has a non-empty string title)
  const isLikelySyllabus = rawItems.some(
    (item) => item && typeof item === "object" && typeof item.title === "string" && item.title.trim().length > 0,
  );
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
    const first = rawItems[0];
    if (first && typeof first.title === "string" && first.title.trim()) {
      const cleanFirst = first.title
        .trim()
        .replace(/^(?:unit|module|chapter|co)\s*[\divx]+[:\-–]\s*/i, "")
        .trim();
      detectedTitle = cleanFirst || first.title.trim();
    }
  }

  // Recursive normalizer to build full SyllabusItem nodes
  function normalizeNode(node: any, prefix: string, index: number): SyllabusItem {
    const id = node.id && typeof node.id === "string" ? node.id : `${prefix}-${index + 1}`;
    const title = typeof node.title === "string" ? node.title.trim() : `Topic ${index + 1}`;
    const status: TopicStatus = ["done", "partial", "barely", "untouched"].includes(node.status)
      ? node.status
      : "untouched";
    const hasNote = Boolean(node.hasNote || node.note);
    const isExpanded = node.isExpanded !== undefined ? Boolean(node.isExpanded) : true;

    const children =
      Array.isArray(node.children) && node.children.length > 0
        ? node.children.map((child: any, cIdx: number) => normalizeNode(child, id, cIdx))
        : undefined;

    return {
      id,
      title,
      status,
      hasNote,
      note: node.note,
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

  // Build existing item lookup by ID and lowercase title to preserve notes and statuses
  const existingMap = new Map<string, SyllabusItem>();
  function indexExisting(list: SyllabusItem[]) {
    for (const it of list) {
      if (it.id) existingMap.set(it.id, it);
      if (it.title) existingMap.set(it.title.trim().toLowerCase(), it);
      if (it.children) indexExisting(it.children);
    }
  }
  indexExisting(existingItems);

  function normalizeItem(node: any, prefix: string, idx: number): SyllabusItem {
    const rawTitle =
      typeof node === "string"
        ? node
        : node && node.title
          ? String(node.title)
          : `Topic ${idx + 1}`;
    const title = rawTitle.trim() || `Topic ${idx + 1}`;
    const matched =
      existingMap.get(title.toLowerCase()) ||
      (node && node.id ? existingMap.get(node.id) : null);

    const id =
      node && node.id && typeof node.id === "string"
        ? node.id
        : matched
          ? matched.id
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
            normalizeItem(c, id, cIdx),
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

  const items = rawItems.map((it, idx) => normalizeItem(it, "u", idx));

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


