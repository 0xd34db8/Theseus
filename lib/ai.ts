import { SyllabusData, SyllabusItem } from "@/types/syllabus";
import { AIConfig, CallLLMOptions } from "@/types/ai";
import {
  getAIConfig,
  getDefaultModelForProvider,
  detectProviderFromKey,
} from "./storage";

function resolveConfig(configOrKey?: string | AIConfig): AIConfig {
  const saved = getAIConfig();
  if (!configOrKey) {
    return saved;
  }
  if (typeof configOrKey === "string") {
    const key = configOrKey.trim();
    return {
      ...saved,
      apiKey: key || saved.apiKey,
      provider:
        saved.apiKey === key ? saved.provider : detectProviderFromKey(key),
      model: saved.model || getDefaultModelForProvider(saved.provider),
    };
  }
  return {
    ...saved,
    ...configOrKey,
    model:
      configOrKey.model ||
      saved.model ||
      getDefaultModelForProvider(configOrKey.provider),
  };
}

/**
 * Universal caller supporting Gemini, OpenAI, Claude, OpenRouter, Groq, and custom endpoints
 */
export async function callUniversalLLM(
  options: CallLLMOptions,
  configOrKey?: string | AIConfig,
): Promise<string> {
  const config = resolveConfig(configOrKey);
  const { provider, apiKey, baseURL } = config;
  const model = config.model || getDefaultModelForProvider(provider);

  if (!apiKey.trim()) {
    throw new Error("API key is missing. Please configure your API key.");
  }

  // 1. Google Gemini Provider
  if (provider === "gemini") {
    const cleanModel = (model || "gemini-3.8-flash").replace(/^models\//, "");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey.trim()}`;
    const parts: any[] = [];

    if (options.fileData) {
      parts.push({
        inlineData: {
          mimeType: options.fileData.mimeType,
          data: options.fileData.base64,
        },
      });
    }

    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${options.userPrompt}`
      : options.userPrompt;
    parts.push({ text: fullPrompt });

    const payload: any = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
      },
    };

    if (options.jsonOutput) {
      payload.generationConfig.responseMimeType = "application/json";
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || "";

      // Auto-fallback if an older model was requested but Gemini requires gemini-3.8-flash
      if (
        cleanModel !== "gemini-3.8-flash" &&
        (msg.includes("gemini-3.8-flash") ||
          msg.includes("no longer available") ||
          res.status === 404)
      ) {
        return callUniversalLLM(options, {
          ...config,
          model: "gemini-3.8-flash",
        });
      }

      throw new Error(
        msg || `Gemini API returned error (${res.status}: ${res.statusText})`,
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response returned from Gemini.");
    return text;
  }

  // 2. Anthropic Claude Provider
  if (provider === "anthropic") {
    const endpoint = "https://api.anthropic.com/v1/messages";
    const messages: any[] = [];
    const content: any[] = [];

    if (options.fileData && options.fileData.mimeType === "application/pdf") {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: options.fileData.base64,
        },
      });
    }

    content.push({ type: "text", text: options.userPrompt });
    messages.push({ role: "user", content });

    const payload: any = {
      model,
      max_tokens: 4096,
      messages,
    };

    if (options.systemPrompt) {
      payload.system = options.systemPrompt;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message ||
          `Claude API returned error (${res.status}: ${res.statusText})`,
      );
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error("Empty response returned from Claude.");
    return text;
  }

  // 3. OpenAI / OpenRouter / Groq / Custom (OpenAI-compatible)
  let endpoint = "https://api.openai.com/v1/chat/completions";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  if (provider === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    headers["HTTP-Referer"] = "https://theseus.app";
    headers["X-Title"] = "Theseus";
  } else if (provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (provider === "custom" && baseURL) {
    const cleanBase = baseURL.replace(/\/+$/, "");
    endpoint = cleanBase.endsWith("/chat/completions")
      ? cleanBase
      : `${cleanBase}/chat/completions`;
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.userPrompt });

  const payload: any = {
    model,
    messages,
    temperature: 0.2,
  };

  if (options.jsonOutput) {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message ||
        `API returned error (${res.status}: ${res.statusText})`,
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response returned from model.");
  return text;
}

/**
 * Validates connection with any configured provider
 */
export async function testUniversalApiKey(
  configOrKey: string | AIConfig,
): Promise<{ valid: boolean; error?: string }> {
  try {
    await callUniversalLLM(
      {
        userPrompt: "Reply strictly with: ok",
      },
      configOrKey,
    );
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || "Validation failed" };
  }
}

interface FormatSyllabusOptions {
  text?: string;
  fileData?: {
    base64: string;
    mimeType: string;
  };
  preferredTitle?: string;
  coreOnly?: boolean;
  nonVerbatim?: boolean;
}

interface RawAiItem {
  title: string;
  children?: RawAiItem[];
}

interface RawAiResponse {
  courseTitle?: string;
  items: RawAiItem[];
}

export function normalizeItems(
  rawList: RawAiItem[],
  prefix = "item",
): SyllabusItem[] {
  return rawList.map((item, idx) => {
    const id = `${prefix}-${idx + 1}`;
    const hasChildren =
      Array.isArray(item.children) && item.children.length > 0;

    return {
      id,
      title: item.title.trim(),
      status: "untouched" as const,
      hasNote: false,
      isExpanded: true,
      children: hasChildren ? normalizeItems(item.children!, id) : undefined,
    };
  });
}

export const SYLLABUS_PARSER_BASE_RULES = `**You are an expert curriculum parser for the Theseus study application.**
**Transform unstructured or tabular syllabus content into a clean hierarchical JSON tree.**

**CRITICAL PARSING & FIDELITY RULES:**

1. **Zero External Knowledge:** You must act strictly as a dumb text extractor. Do NOT add, expand, or hallucinate any topics, subtopics, or details that are not explicitly written in the source document. Do not use your training data to fill in "missing" concepts. If the syllabus lists a broad topic, leave it broad.
2. **Verbatim Extraction:** Extract the exact Course Title from the document header, and use the exact phrasing for all topics. NEVER generate, guess, or paraphrase text.
3. **Strict Structural Fidelity (No Invented Taxonomy):** Do NOT invent categories, logical groups, or sub-folders that do not explicitly exist in the source text. If a module consists of a single flat paragraph of topics, extract them as a flat list of sibling items. Never play editor.
4. **Hierarchy Levels:**
* **Top-Level:** Each explicitly named Unit, Module, or Chapter is a top-level item (e.g., "UNIT I: Introduction").
* **Sub-Levels:** Only create nested child items if the text explicitly dictates a parent-child relationship.
* Leaf-Level: You MUST split dense comma-separated or dash-separated lists into individual, distinct subtopic items. Splitting a list into separate JSON items does not violate the verbatim rule.

5. **Completeness:** NEVER omit any conceptual topic from the source syllabus. Preserve all academic concepts mentioned.`;

export const CORE_SYLLABUS_FILTER_RULE = `**CORE SYLLABUS ONLY RULE:**

* Focus exclusively on the core curriculum, units, modules, chapters, and conceptual topics.
* STRICTLY IGNORE and EXCLUDE all non-core sections such as lab components, practical experiments, course outcomes, learning objectives, textbooks/reference book lists, grading schemes, evaluation rubrics, and exam patterns, guest lectures.`;

export const SYLLABUS_TREE_OUTPUT_SCHEMA = `**OUTPUT SCHEMA:**
Output STRICTLY valid, parsed JSON matching this exact schema. Do not include markdown formatting blocks (like \`\`\`json), preambles, or postscripts. Just the raw JSON object:
{
  "courseTitle": "Exact Course Title Extracted from Document",
  "items": [
    {
      "title": "Module 1: ...",
      "children": [
        {
          "title": "Exact Section Name from Text",
          "children": [
            { "title": "Individual Subtopic A" },
            { "title": "Individual Subtopic B" }
          ]
        },
        { "title": "Standalone Topic C" }
      ]
    }
  ]
}`;

export const NON_VERBATIM_SYLLABUS_TREE_PROMPT = `You are a curriculum parser for the Theseus study application.
Transform messy or tabular syllabus content into a clean hierarchical tree.

CRITICAL FORMATTING RULES:
1. Top-Level: Each Unit, Module, or Chapter is a top-level item (e.g. "UNIT I: Introduction to Machine Learning").
2. Mid-Level: Logical groups, sections, or categories are child items.
3. Leaf-Level: Break down dense comma-separated or dash-separated lists into clean, distinct subtopic items.
4. Completeness: NEVER omit any topic from the source syllabus. Preserve all academic concepts mentioned.
5. Output format: Output strictly valid JSON matching this schema:
{
  "courseTitle": "Course / Subject Title",
  "items": [
    {
      "title": "UNIT I/Module 1: ...",
      "children": [
        {
          "title": "Section / Topic Group",
          "children": [
            { "title": "Subtopic A" },
            { "title": "Subtopic B" }
          ]
        }
      ]
    }
  ]
}`;

export function buildSyllabusTreePrompt(options?: {
  coreOnly?: boolean;
  nonVerbatim?: boolean;
}): string {
  const isCoreOnly = options?.coreOnly !== false;
  const isNonVerbatim = options?.nonVerbatim === true;

  if (isNonVerbatim) {
    const sections = [NON_VERBATIM_SYLLABUS_TREE_PROMPT];
    if (isCoreOnly) {
      sections.push(CORE_SYLLABUS_FILTER_RULE);
    }
    return sections.join("\n\n");
  }

  const sections = [SYLLABUS_PARSER_BASE_RULES];
  if (isCoreOnly) {
    sections.push(CORE_SYLLABUS_FILTER_RULE);
  }
  sections.push(SYLLABUS_TREE_OUTPUT_SCHEMA);
  return sections.join("\n\n");
}

export const SYLLABUS_TREE_SYSTEM_PROMPT = buildSyllabusTreePrompt({ coreOnly: true });

/**
 * Generates a prompt for external LLM interfaces (ChatGPT, Claude, Gemini, etc.)
 * to format a syllabus into Theseus's JSON tree structure.
 */
export function getSyllabusTreePrompt(options?: {
  rawText?: string;
  coreOnly?: boolean;
  nonVerbatim?: boolean;
}): string {
  const isCoreOnly = options?.coreOnly !== false;
  const isNonVerbatim = options?.nonVerbatim === true;
  const basePrompt = buildSyllabusTreePrompt({
    coreOnly: isCoreOnly,
    nonVerbatim: isNonVerbatim,
  });

  if (options?.rawText && options.rawText.trim()) {
    return `${basePrompt}\n\nSyllabus Content:\n\n${options.rawText.trim()}`;
  }
  return `${basePrompt}\n\nPlease parse the attached document into the structured syllabus format.`;
}

/**
 * Generates a prompt for external LLM interfaces to produce comprehensive study notes
 * for a specific syllabus topic in GitHub-flavored Markdown.
 */
export function getNoteGenerationPrompt(options: {
  topicTitle: string;
  parentTitle?: string;
  courseTitle?: string;
}): string {
  const contextParts: string[] = [];
  contextParts.push(`Topic: "${options.topicTitle}"`);
  if (options.parentTitle) {
    contextParts.push(`Unit/Section: "${options.parentTitle}"`);
  }
  if (options.courseTitle) {
    contextParts.push(`Course: "${options.courseTitle}"`);
  }

  return `You are an academic study tutor for the Theseus app.
Generate comprehensive study notes in GitHub-flavored Markdown for the given syllabus topic.

${contextParts.join("\n")}

Structure your notes clearly:
### Overview
Brief definition and scope.

### Key Concepts & Mechanisms
Bullet points breaking down mechanisms, components, and principles.

### Formulas / Code / Diagrams (if applicable)
Use clean LaTeX ($$...$$) or code blocks.

### Real-World Applications & Examples
Practical usage.

### High-Yield Summary
Key takeaways.

Start directly with markdown content. Do not include conversational remarks.`;
}

/**
 * Formats syllabus text or file into hierarchical items using the configured LLM
 */
export async function formatSyllabusWithAI(
  options: FormatSyllabusOptions,
  configOrKey?: string | AIConfig,
): Promise<SyllabusData> {
  const isCoreOnly = options.coreOnly !== false;
  const isNonVerbatim = options.nonVerbatim === true;
  const systemPrompt = buildSyllabusTreePrompt({
    coreOnly: isCoreOnly,
    nonVerbatim: isNonVerbatim,
  });

  const userPrompt = options.text
    ? `Syllabus Content:\n\n${options.text}`
    : "Please parse the attached document into the structured syllabus format.";

  const rawJson = await callUniversalLLM(
    {
      systemPrompt,
      userPrompt,
      jsonOutput: true,
      fileData: options.fileData,
    },
    configOrKey,
  );

  let parsed: RawAiResponse;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    const cleaned = rawJson
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  }

  const title =
    options.preferredTitle?.trim() ||
    parsed.courseTitle?.trim() ||
    "Curriculum Syllabus";

  const items =
    Array.isArray(parsed.items) && parsed.items.length > 0
      ? normalizeItems(parsed.items, "u")
      : [
          {
            id: "u-1",
            title: "UNIT I: Course Overview",
            status: "untouched" as const,
            hasNote: false,
            isExpanded: true,
          },
        ];

  return {
    id: `syllabus-${Date.now()}`,
    fileName: title,
    lastModified: "Just now",
    items,
  };
}

/**
 * Generates study notes in Markdown for a topic using the configured LLM
 */
export async function generateNotesWithAI(
  options: {
    topicTitle: string;
    parentTitle?: string;
    courseTitle?: string;
  },
  configOrKey?: string | AIConfig,
): Promise<string> {
  const systemPrompt = `You are an academic study tutor for the Theseus app.
Generate comprehensive study notes in GitHub-flavored Markdown for the given syllabus topic.

Structure your notes clearly:
### Overview
Brief definition and scope.

### Key Concepts & Mechanisms
Bullet points breaking down mechanisms, components, and principles.

### Formulas / Code / Diagrams (if applicable)
Use clean LaTeX ($$...$$) or code blocks.

### Real-World Applications & Examples
Practical usage.

### High-Yield Summary
Key takeaways.

Start directly with markdown content. Do not include conversational remarks.`;

  const userPrompt = `Topic: "${options.topicTitle}"
${options.parentTitle ? `Unit/Section: "${options.parentTitle}"` : ""}
${options.courseTitle ? `Course: "${options.courseTitle}"` : ""}`;

  const notes = await callUniversalLLM(
    {
      systemPrompt,
      userPrompt,
      jsonOutput: false,
    },
    configOrKey,
  );

  return notes.trim();
}

/**
 * Generates a focused sub-section explanation in JSON
 */
export async function generateSubCommentWithAI(
  options: {
    topicTitle: string;
    aspectOrQuestion: string;
  },
  configOrKey?: string | AIConfig,
): Promise<{ title: string; content: string }> {
  const systemPrompt = `For the syllabus topic "${options.topicTitle}", explain the aspect: "${options.aspectOrQuestion}".
Output strictly valid JSON with:
{
  "title": "Short subtitle (2-4 words)",
  "content": "Clear, markdown-formatted explanation"
}`;

  const responseText = await callUniversalLLM(
    {
      systemPrompt,
      userPrompt: `Explain: ${options.aspectOrQuestion}`,
      jsonOutput: true,
    },
    configOrKey,
  );

  try {
    const data = JSON.parse(responseText);
    return {
      title: data.title || "Sub-section",
      content: data.content || responseText,
    };
  } catch {
    return {
      title: "Sub-section",
      content: responseText,
    };
  }
}
