import {
  NoteComment,
  SyllabusData,
  SyllabusItem,
  TopicNote,
  TopicStatus,
} from "@/types/syllabus";
import { stripModulePrefix } from "./syllabusUtils";

function normalizeImportedNote(
  rawNote: unknown,
  itemId: string,
  itemTitle: string,
): TopicNote | undefined {
  if (!rawNote || typeof rawNote !== "object" || Array.isArray(rawNote)) {
    return undefined;
  }
  const n = rawNote as Record<string, unknown>;
  const content = typeof n.content === "string" ? n.content : "";

  let subComments: NoteComment[] | undefined;
  if (Array.isArray(n.subComments)) {
    subComments = n.subComments
      .filter(
        (c): c is Record<string, unknown> =>
          Boolean(c) &&
          typeof c === "object" &&
          !Array.isArray(c) &&
          typeof (c as Record<string, unknown>).content === "string",
      )
      .map((c, idx) => ({
        id:
          typeof c.id === "string" && c.id.trim()
            ? c.id
            : `comment-${itemId}-${idx + 1}`,
        author: typeof c.author === "string" ? c.author : "",
        timestamp: typeof c.timestamp === "string" ? c.timestamp : "",
        content: c.content as string,
        ...(typeof c.imageUrl === "string" ? { imageUrl: c.imageUrl } : {}),
      }));
  }

  return {
    id: typeof n.id === "string" && n.id.trim() ? n.id : `note-${itemId}`,
    title:
      typeof n.title === "string" && n.title.trim() ? n.title : itemTitle,
    content,
    ...(typeof n.imageUrl === "string" ? { imageUrl: n.imageUrl } : {}),
    ...(subComments !== undefined ? { subComments } : {}),
    updatedAt: typeof n.updatedAt === "string" ? n.updatedAt : "",
  };
}

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

    const titleCandidates = [
      parsed.courseTitle,
      parsed.fileName,
      parsed.title,
      parsed.name,
      parsed.courseName,
      parsed.course,
      parsed.subject,
      parsed.syllabus?.courseTitle,
      parsed.syllabus?.fileName,
      parsed.syllabus?.title,
      parsed.data?.courseTitle,
      parsed.data?.title,
    ];
    const validTitle = titleCandidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    );
    jsonTitle = validTitle || "";
  }

  if (!rawItems || rawItems.length === 0) return null;

  const nonNullItems = rawItems.filter((item) => item !== null && item !== undefined);
  if (nonNullItems.length === 0) return null;

  // Verify that it actually looks like syllabus items (at least one item has a non-empty title/name)
  const isLikelySyllabus = nonNullItems.some((item) => getItemTitle(item).length > 0);
  if (!isLikelySyllabus) return null;

  let detectedTitle = jsonTitle.trim();

  // If JSON had no title, use fallbackTitle if it is not generic
  if (!detectedTitle && typeof fallbackTitle === "string" && fallbackTitle.trim()) {
    const cleanFallback = fallbackTitle.trim();
    if (cleanFallback !== "New Syllabus" && cleanFallback !== "Imported Syllabus") {
      detectedTitle = cleanFallback;
    }
  }

  // If still no title and rawItems exist, derive from first item title
  if (!detectedTitle && nonNullItems.length > 0) {
    const firstTitle = getItemTitle(nonNullItems[0]);
    if (firstTitle) {
      detectedTitle = stripModulePrefix(firstTitle);
    }
  }

  // Recursive normalizer to build full SyllabusItem nodes
  function normalizeNode(node: any, prefix: string, index: number): SyllabusItem {
    const isObj = Boolean(node) && typeof node === "object" && !Array.isArray(node);
    const id =
      isObj && typeof node.id === "string" && node.id.trim()
        ? node.id
        : `${prefix}-${index + 1}`;
    const rawTitle = getItemTitle(node);
    const title = rawTitle || `Topic ${index + 1}`;
    const status: TopicStatus =
      isObj &&
      typeof node.status === "string" &&
      ["done", "partial", "barely", "untouched"].includes(node.status)
        ? (node.status as TopicStatus)
        : "untouched";
    const note = isObj ? normalizeImportedNote(node.note, id, title) : undefined;
    const hasNote = Boolean(isObj && (node.hasNote === true || note !== undefined));
    const isExpanded =
      isObj && node.isExpanded !== undefined ? Boolean(node.isExpanded) : true;

    const rawChildren = isObj
      ? node.children || node.subtopics || node.subSections || node.sections || node.items
      : undefined;

    const validChildren = Array.isArray(rawChildren)
      ? rawChildren.filter((child: any) => child !== null && child !== undefined)
      : [];

    const children =
      validChildren.length > 0
        ? validChildren.map((child: any, cIdx: number) =>
            normalizeNode(child, id, cIdx),
          )
        : undefined;

    return {
      id,
      title,
      status,
      hasNote,
      note,
      isExpanded,
      children,
    };
  }

  const items = nonNullItems.map((item, idx) => normalizeNode(item, "u", idx));
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

  const validRawItems = rawItems.filter(
    (it) => it !== null && it !== undefined && (typeof it === "string" || (typeof it === "object" && !Array.isArray(it))),
  );
  if (validRawItems.length === 0) {
    return { items: null, isValid };
  }

  // Build existing item lookup by ID, hierarchical path, and title
  const existingById = new Map<string, SyllabusItem>();
  const existingByPath = new Map<string, SyllabusItem>();
  const existingBySiblingTitle = new Map<string, SyllabusItem[]>();
  const existingByTitleList = new Map<string, SyllabusItem[]>();
  const usedIds = new Set<string>();

  function indexExisting(list: SyllabusItem[], parentPath: string = "") {
    list.forEach((it, idx) => {
      const currentPath = parentPath ? `${parentPath}.${idx}` : `${idx}`;
      if (it.id) existingById.set(it.id, it);
      existingByPath.set(currentPath, it);

      if (it.title) {
        const cleanTitle = it.title.trim().toLowerCase();
        const sibKey = `${parentPath}:${cleanTitle}`;
        const sibGroup = existingBySiblingTitle.get(sibKey) || [];
        sibGroup.push(it);
        existingBySiblingTitle.set(sibKey, sibGroup);

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

  interface PreparedNode {
    raw: any;
    isObj: boolean;
    title: string;
    cleanTitle: string;
    idx: number;
    parentPath: string;
    currentPath: string;
    matched: SyllabusItem | null;
    children: PreparedNode[];
  }

  function prepareNodes(list: any[], parentPath: string = ""): PreparedNode[] {
    const valid = list.filter(
      (it) =>
        it !== null &&
        it !== undefined &&
        (typeof it === "string" || (typeof it === "object" && !Array.isArray(it))),
    );
    return valid.map((node, idx) => {
      const isObj =
        Boolean(node) && typeof node === "object" && !Array.isArray(node);
      const currentPath = parentPath ? `${parentPath}.${idx}` : `${idx}`;
      const rawTitle =
        typeof node === "string"
          ? node
          : isObj && typeof node.title === "string"
            ? node.title
            : `Topic ${idx + 1}`;
      const title = rawTitle.trim() || `Topic ${idx + 1}`;
      const cleanTitle = title.toLowerCase();
      const children =
        isObj && Array.isArray(node.children)
          ? prepareNodes(node.children, currentPath)
          : [];

      return {
        raw: node,
        isObj,
        title,
        cleanTitle,
        idx,
        parentPath,
        currentPath,
        matched: null,
        children,
      };
    });
  }

  const preparedTree = prepareNodes(validRawItems, "");

  function walkPrepared(
    nodes: PreparedNode[],
    visitor: (n: PreparedNode) => void,
  ) {
    for (const n of nodes) {
      visitor(n);
      if (n.children.length > 0) {
        walkPrepared(n.children, visitor);
      }
    }
  }

  // Pass 1a: Direct ID match
  walkPrepared(preparedTree, (n) => {
    if (
      n.isObj &&
      typeof n.raw.id === "string" &&
      existingById.has(n.raw.id) &&
      !usedIds.has(n.raw.id)
    ) {
      const cand = existingById.get(n.raw.id)!;
      n.matched = cand;
      usedIds.add(cand.id);
    }
  });

  // Pass 1b: Exact path + exact title match (keeps duplicate-titled siblings anchored)
  walkPrepared(preparedTree, (n) => {
    if (n.matched) return;
    const cand = existingByPath.get(n.currentPath);
    if (
      cand &&
      !usedIds.has(cand.id) &&
      cand.title.trim().toLowerCase() === n.cleanTitle
    ) {
      n.matched = cand;
      usedIds.add(cand.id);
    }
  });

  // Pass 1c: Sibling title match within same parent path (preserves notes on reorder/insert)
  walkPrepared(preparedTree, (n) => {
    if (n.matched) return;
    const sibCandidates = existingBySiblingTitle.get(
      `${n.parentPath}:${n.cleanTitle}`,
    );
    if (sibCandidates) {
      for (const cand of sibCandidates) {
        if (!usedIds.has(cand.id)) {
          n.matched = cand;
          usedIds.add(cand.id);
          break;
        }
      }
    }
  });

  // Pass 1d: Global title match across tree (preserves notes when moving topics across units)
  walkPrepared(preparedTree, (n) => {
    if (n.matched) return;
    const candidates = existingByTitleList.get(n.cleanTitle);
    if (candidates) {
      for (const cand of candidates) {
        if (!usedIds.has(cand.id)) {
          n.matched = cand;
          usedIds.add(cand.id);
          break;
        }
      }
    }
  });

  // Pass 2: Positional path fallback ONLY for unclaimed existing items (supports in-place renames)
  walkPrepared(preparedTree, (n) => {
    if (n.matched) return;
    const candidateByPath = existingByPath.get(n.currentPath);
    if (
      candidateByPath &&
      !usedIds.has(candidateByPath.id) &&
      !(n.isObj && n.raw.id)
    ) {
      n.matched = candidateByPath;
      usedIds.add(candidateByPath.id);
    }
  });

  function buildItem(n: PreparedNode, prefix: string): SyllabusItem {
    const { raw: node, isObj, title, idx, matched } = n;

    const id = matched
      ? matched.id
      : isObj && typeof node.id === "string" && !usedIds.has(node.id)
        ? (usedIds.add(node.id), node.id)
        : `${prefix}-${Date.now()}-${idx}`;

    const status: TopicStatus =
      isObj &&
      typeof node.status === "string" &&
      ["done", "partial", "barely", "untouched"].includes(node.status)
        ? (node.status as TopicStatus)
        : matched
          ? matched.status
          : "untouched";

    const validatedNodeNote = isObj
      ? normalizeImportedNote(node.note, id, title)
      : undefined;
    const note = validatedNodeNote ?? (matched ? matched.note : undefined);

    const hasNote = Boolean(
      (isObj && (node.hasNote === true || validatedNodeNote !== undefined)) ||
        (matched && (matched.hasNote || matched.note)),
    );

    const isExpanded =
      isObj && node.isExpanded !== undefined
        ? Boolean(node.isExpanded)
        : matched
          ? matched.isExpanded
          : true;

    const children =
      n.children.length > 0
        ? n.children.map((c) => buildItem(c, id))
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

  const items = preparedTree.map((n) => buildItem(n, "u"));

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


