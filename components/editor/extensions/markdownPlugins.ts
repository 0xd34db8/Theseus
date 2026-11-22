import { Extension } from "@tiptap/core";
import markdownItFootnote from "markdown-it-footnote";
// @ts-ignore
import markdownItDeflist from "markdown-it-deflist";
import { sanitizeLatex } from "../MathNode";
import { parseYouTubeUrl } from "@/lib/youtube";

const DANGEROUS_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "object",
  "embed",
  "applet",
  "base",
  "link",
  "meta",
  "template",
  "svg",
  "form",
  "textarea",
  "select",
  "button",
  "audio",
  "video",
  "source",
  "track",
  "portal",
  "frame",
  "frameset",
]);

const SAFE_DATA_IMAGE_REGEX =
  /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif);base64,[a-z0-9+/=\s]+$/i;

function isSafeUrl(raw: string, allowDataImage: boolean): boolean {
  const cleaned = raw.replace(/[\u0000-\u0020]+/g, "").trim();
  if (!cleaned) return false;

  if (
    cleaned.startsWith("#") ||
    cleaned.startsWith("/") ||
    cleaned.startsWith("./") ||
    cleaned.startsWith("../")
  ) {
    return true;
  }

  if (allowDataImage && SAFE_DATA_IMAGE_REGEX.test(cleaned)) {
    return true;
  }

  const schemeMatch = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) {
    return true;
  }

  const scheme = schemeMatch[1].toLowerCase();
  if (allowDataImage) {
    return scheme === "http" || scheme === "https";
  }
  return scheme === "http" || scheme === "https" || scheme === "mailto";
}

function sanitizeInlineStyle(rawStyle: string): string {
  const safeDecls: string[] = [];
  for (const part of rawStyle.split(";")) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = part.slice(0, colonIdx).trim().toLowerCase();
    const val = part.slice(colonIdx + 1).trim();
    if (!val || /url\s*\(|expression\s*\(|javascript:/i.test(val)) continue;

    if (
      prop === "text-align" &&
      /^(left|center|right|justify|start|end)$/i.test(val)
    ) {
      safeDecls.push(`text-align: ${val.toLowerCase()}`);
    } else if (
      prop === "font-size" &&
      /^\d+(?:\.\d+)?(?:px|em|rem|%)$/i.test(val)
    ) {
      safeDecls.push(`font-size: ${val.toLowerCase()}`);
    } else if (prop === "width" && /^\d+(?:\.\d+)?(?:px|%)$/i.test(val)) {
      safeDecls.push(`width: ${val.toLowerCase()}`);
    }
  }
  return safeDecls.join("; ");
}

/**
 * Sanitizes an inert parsed DOM subtree before TipTap converts it to ProseMirror nodes.
 * Preserves valid formatting tags (u, mark, span font-size, aligned blocks, resized img, YouTube embeds, task checkboxes)
 * while stripping executable elements, event handler attributes, and unsafe URLs/styles.
 */
export function sanitizeParsedDOM(root: HTMLElement): void {
  if (!root) return;

  const elements = Array.from(root.querySelectorAll("*"));
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();

    if (DANGEROUS_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (tag === "iframe") {
      el.removeAttribute("srcdoc");
      const src = el.getAttribute("src") || "";
      if (!parseYouTubeUrl(src)) {
        el.remove();
        continue;
      }
    }

    if (tag === "input") {
      const inputType = (el.getAttribute("type") || "").toLowerCase();
      if (inputType !== "checkbox") {
        el.remove();
        continue;
      }
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value;

      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        name === "formaction" ||
        name === "xlink:href" ||
        name === "xmlns"
      ) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === "href" || name === "action") {
        if (!isSafeUrl(val, false)) {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (name === "src" || name === "data-src") {
        const allowDataImage = tag === "img";
        if (!isSafeUrl(val, allowDataImage)) {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (name === "style") {
        const cleanedStyle = sanitizeInlineStyle(val);
        if (cleanedStyle) {
          el.setAttribute("style", cleanedStyle);
        } else {
          el.removeAttribute("style");
        }
      }
    }
  }
}

function markdownItMath(md: any) {
  function mathBlock(
    state: any,
    startLine: number,
    endLine: number,
    silent: boolean,
  ) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (pos >= max) return false;

    const isDollar =
      state.src.charCodeAt(pos) === 0x24 &&
      state.src.charCodeAt(pos + 1) === 0x24;
    const isBracket =
      state.src.charCodeAt(pos) === 0x5c &&
      state.src.charCodeAt(pos + 1) === 0x5b;
    if (!isDollar && !isBracket) return false;

    const openMarker = isDollar ? "$$" : "\\[";
    const closeMarker = isDollar ? "$$" : "\\]";

    pos += 2;
    const firstLine = state.src.slice(pos, max);
    if (silent) return true;

    let haveEndMarker = false;
    let nextLine = startLine;
    const sameLineEnd = firstLine.indexOf(closeMarker);
    const lines: string[] = [];

    if (sameLineEnd !== -1) {
      haveEndMarker = true;
      lines.push(firstLine.slice(0, sameLineEnd));
      nextLine = startLine + 1;
    } else {
      lines.push(firstLine);
      for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];
        const lineText = state.src.slice(pos, max);
        const endIdx = lineText.indexOf(closeMarker);
        if (endIdx !== -1) {
          haveEndMarker = true;
          lines.push(lineText.slice(0, endIdx));
          nextLine++;
          break;
        }
        lines.push(lineText);
      }
    }

    if (!haveEndMarker) return false;
    state.line = nextLine;
    const token = state.push("math_block", "div", 0);
    token.block = true;
    token.content = lines.join("\n").trim();
    token.markup = openMarker;
    return true;
  }

  function mathInline(state: any, silent: boolean) {
    const pos = state.pos;
    const max = state.posMax;
    if (pos >= max) return false;

    const isDollar = state.src.charCodeAt(pos) === 0x24;
    const isBracket =
      state.src.charCodeAt(pos) === 0x5c &&
      pos + 1 < max &&
      state.src.charCodeAt(pos + 1) === 0x28;

    if (!isDollar && !isBracket) return false;
    if (
      isDollar &&
      pos + 1 < max &&
      state.src.charCodeAt(pos + 1) === 0x24
    ) {
      return false;
    }
    if (isDollar && pos > 0 && state.src.charCodeAt(pos - 1) === 0x5c) {
      return false;
    }

    const openMarker = isDollar ? "$" : "\\(";
    const closeMarker = isDollar ? "$" : "\\)";

    if (isDollar && pos + 1 < max && /\s/.test(state.src[pos + 1])) {
      return false;
    }

    const start = pos + openMarker.length;
    let match = -1;

    for (let i = start; i < max; i++) {
      if (isDollar) {
        if (
          state.src.charCodeAt(i) === 0x24 &&
          state.src.charCodeAt(i - 1) !== 0x5c &&
          !/\s/.test(state.src[i - 1])
        ) {
          match = i;
          break;
        }
      } else if (
        state.src.slice(i, i + 2) === "\\)" &&
        state.src.charCodeAt(i - 1) !== 0x5c
      ) {
        match = i;
        break;
      }
    }

    if (match === -1) return false;
    if (silent) return true;

    const content = state.src.slice(start, match).trim();
    if (!content) return false;

    state.pos = match + closeMarker.length;
    const token = state.push("math_inline", "span", 0);
    token.content = content;
    token.markup = openMarker;
    return true;
  }

  md.block.ruler.before("fence", "math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.inline.ruler.before("escape", "math_inline", mathInline);

  md.renderer.rules.math_block = (tokens: any[], idx: number) => {
    const clean = sanitizeLatex(tokens[idx].content);
    return (
      '<div data-type="mathNode" data-display="yes" data-latex="' +
      encodeURIComponent(clean) +
      '"></div>\n'
    );
  };

  md.renderer.rules.math_inline = (tokens: any[], idx: number) => {
    const clean = sanitizeLatex(tokens[idx].content);
    return (
      '<span data-type="mathNode" data-display="no" data-latex="' +
      encodeURIComponent(clean) +
      '"></span>'
    );
  };
}

function markdownItMark(md: any) {
  function markInline(state: any, silent: boolean) {
    const start = state.pos;
    const max = state.posMax;
    if (
      start + 4 > max ||
      state.src.charCodeAt(start) !== 0x3d ||
      state.src.charCodeAt(start + 1) !== 0x3d
    ) {
      return false;
    }
    if (start > 0 && state.src.charCodeAt(start - 1) === 0x5c) {
      return false;
    }
    if (
      state.src.charCodeAt(start + 2) === 0x3d ||
      /\s/.test(state.src[start + 2])
    ) {
      return false;
    }

    let end = -1;
    for (let i = start + 2; i < max - 1; i++) {
      if (
        state.src.charCodeAt(i) === 0x3d &&
        state.src.charCodeAt(i + 1) === 0x3d &&
        state.src.charCodeAt(i - 1) !== 0x5c &&
        !/\s/.test(state.src[i - 1])
      ) {
        end = i;
        break;
      }
    }

    if (end === -1 || end === start + 2) return false;
    if (silent) return true;

    state.push("mark_open", "mark", 1);
    const oldMax = state.posMax;
    state.pos = start + 2;
    state.posMax = end;
    state.md.inline.tokenize(state);
    state.pos = end + 2;
    state.posMax = oldMax;
    state.push("mark_close", "mark", -1);
    return true;
  }

  md.inline.ruler.before("emphasis", "theseus_mark", markInline);
}

/**
 * Extension that hooks markdown-it plugins (footnotes, definition lists, LaTeX math, highlight) into tiptap-markdown.
 */
export const MarkdownPlugins = Extension.create({
  name: "markdownPlugins",
  addStorage() {
    return {
      markdown: {
        parse: {
          setup(md: any) {
            if ((md as any).__theseusPluginsInstalled) return;
            (md as any).__theseusPluginsInstalled = true;

            const fn =
              (markdownItFootnote as any)?.default || markdownItFootnote;
            const def =
              (markdownItDeflist as any)?.default || markdownItDeflist;
            if (typeof fn === "function") md.use(fn);
            if (typeof def === "function") md.use(def);
            md.use(markdownItMath);
            md.use(markdownItMark);
          },
          updateDOM(element: HTMLElement) {
            if (!element) return;
            const doc = element.ownerDocument;
            if (!doc) return;

            // 0. Sanitize raw HTML in the inert DOMParser tree before any transformations
            sanitizeParsedDOM(element);

            // 1. Definition Lists: strip any trailing backslashes from <dt>
            element
              .querySelectorAll("dt, .theseus-definition-term")
              .forEach((dt) => {
                if (dt.textContent && dt.textContent.includes("\\")) {
                  dt.textContent = dt.textContent
                    .replace(/\\+\s*$/, "")
                    .trim();
                }
              });

            // 2. Footnotes: transform all <section class="footnotes"> and <li class="footnote-item">
            element
              .querySelectorAll("section.footnotes")
              .forEach((footnotesSection) => {
                const items =
                  footnotesSection.querySelectorAll("li.footnote-item");
                const defNodes: HTMLElement[] = [];
                items.forEach((item) => {
                  const rawId = item.getAttribute("id") || "";
                  const label = rawId.replace(/^fn/, "") || "1";
                  item
                    .querySelectorAll(".footnote-backref")
                    .forEach((br) => br.remove());
                  const div = doc.createElement("div");
                  div.setAttribute("data-type", "footnoteDefinition");
                  div.setAttribute("data-label", label);
                  const source = item.querySelector("p") || item;
                  while (source.firstChild) {
                    div.appendChild(source.firstChild);
                  }
                  if (
                    div.firstChild?.nodeType === 3 &&
                    div.firstChild.nodeValue
                  ) {
                    div.firstChild.nodeValue =
                      div.firstChild.nodeValue.trimStart();
                  }
                  if (div.lastChild?.nodeType === 3 && div.lastChild.nodeValue) {
                    div.lastChild.nodeValue =
                      div.lastChild.nodeValue.trimEnd();
                  }
                  defNodes.push(div);
                });
                footnotesSection.replaceWith(...defNodes);
              });
            element
              .querySelectorAll("hr.footnotes-sep")
              .forEach((hr) => hr.remove());

            // 3. Footnote references in <sup class="footnote-ref">
            element.querySelectorAll("sup.footnote-ref").forEach((sup) => {
              const link = sup.querySelector("a");
              const text = (link ? link.textContent : sup.textContent) || "1";
              const label = text.replace(/[\[\]\^]/g, "").trim() || "1";
              const span = doc.createElement("span");
              span.setAttribute("data-type", "footnoteReference");
              span.setAttribute("data-label", label);
              span.textContent = `[${label}]`;
              sup.replaceWith(span);
            });

            // 4. Raw unparsed footnote definitions in paragraphs: <p>[^1]: Content</p>
            element.querySelectorAll("p").forEach((p) => {
              const firstNode = p.firstChild;
              if (!firstNode || firstNode.nodeType !== 3) return;
              const leadingText = firstNode.nodeValue || "";
              const match = leadingText.match(/^\s*\[\^([^\]\s]+)\]:\s*/);
              if (!match) return;

              const remainder = leadingText.slice(match[0].length);
              const hasFollowingContent =
                remainder.trim().length > 0 || p.childNodes.length > 1;
              if (!hasFollowingContent) return;

              const div = doc.createElement("div");
              div.setAttribute("data-type", "footnoteDefinition");
              div.setAttribute("data-label", match[1]);
              if (remainder) {
                div.appendChild(doc.createTextNode(remainder));
              }
              let next = firstNode.nextSibling;
              while (next) {
                const following = next.nextSibling;
                div.appendChild(next);
                next = following;
              }
              if (div.lastChild?.nodeType === 3 && div.lastChild.nodeValue) {
                div.lastChild.nodeValue = div.lastChild.nodeValue.trimEnd();
              }
              p.replaceWith(div);
            });

            // 5. Raw unparsed footnote references in text nodes: [^1]
            const walker = doc.createTreeWalker(element, 4 /* SHOW_TEXT */);
            let textNode: Node | null;
            const textNodesToFix: ChildNode[] = [];
            while ((textNode = walker.nextNode())) {
              if (
                textNode.nodeValue &&
                /\[\^([^\]\s]+)\]/.test(textNode.nodeValue)
              ) {
                const parent = textNode.parentElement;
                if (
                  !parent?.closest(
                    '[data-type="footnoteReference"], [data-type="footnoteDefinition"], pre, code',
                  )
                ) {
                  textNodesToFix.push(textNode as ChildNode);
                }
              }
            }
            for (const tn of textNodesToFix) {
              const val = tn.nodeValue || "";
              const regex = /\[\^([^\]\s]+)\]/g;
              const frag = doc.createDocumentFragment();
              let lastIndex = 0;
              let match: RegExpExecArray | null;
              while ((match = regex.exec(val)) !== null) {
                if (match.index > lastIndex) {
                  frag.appendChild(
                    doc.createTextNode(val.slice(lastIndex, match.index)),
                  );
                }
                const label = match[1];
                const span = doc.createElement("span");
                span.setAttribute("data-type", "footnoteReference");
                span.setAttribute("data-label", label);
                span.textContent = `[${label}]`;
                frag.appendChild(span);
                lastIndex = match.index + match[0].length;
              }
              if (lastIndex > 0) {
                if (lastIndex < val.length) {
                  frag.appendChild(doc.createTextNode(val.slice(lastIndex)));
                }
                tn.replaceWith(frag);
              }
            }
          },
        },
      },
    };
  },
});
