import { Extension } from "@tiptap/core";
import markdownItFootnote from "markdown-it-footnote";
// @ts-ignore
import markdownItDeflist from "markdown-it-deflist";
import { sanitizeLatex } from "../MathNode";

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

/**
 * Extension that hooks markdown-it plugins (footnotes, definition lists, LaTeX math) into tiptap-markdown.
 */
export const MarkdownPlugins = Extension.create({
  name: "markdownPlugins",
  addStorage() {
    return {
      markdown: {
        parse: {
          setup(md: any) {
            const fn =
              (markdownItFootnote as any)?.default || markdownItFootnote;
            const def =
              (markdownItDeflist as any)?.default || markdownItDeflist;
            if (typeof fn === "function") md.use(fn);
            if (typeof def === "function") md.use(def);
            md.use(markdownItMath);
          },
          updateDOM(element: HTMLElement) {
            if (typeof window === "undefined" || !element) return;

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

            // 2. Footnotes: transform <section class="footnotes"> and <li class="footnote-item">
            const footnotesSection = element.querySelector("section.footnotes");
            if (footnotesSection) {
              const items =
                footnotesSection.querySelectorAll("li.footnote-item");
              const defNodes: HTMLElement[] = [];
              items.forEach((item) => {
                const rawId = item.getAttribute("id") || "";
                const label = rawId.replace(/^fn/, "") || "1";
                item
                  .querySelectorAll(".footnote-backref")
                  .forEach((br) => br.remove());
                const div = document.createElement("div");
                div.setAttribute("data-type", "footnoteDefinition");
                div.setAttribute("data-label", label);
                const p = item.querySelector("p");
                div.innerHTML = (p ? p.innerHTML : item.innerHTML).trim();
                defNodes.push(div);
              });
              footnotesSection.replaceWith(...defNodes);
            }
            element
              .querySelectorAll("hr.footnotes-sep")
              .forEach((hr) => hr.remove());

            // 3. Footnote references in <sup class="footnote-ref">
            element.querySelectorAll("sup.footnote-ref").forEach((sup) => {
              const link = sup.querySelector("a");
              const text = (link ? link.textContent : sup.textContent) || "1";
              const label = text.replace(/[\[\]\^]/g, "").trim() || "1";
              const span = document.createElement("span");
              span.setAttribute("data-type", "footnoteReference");
              span.setAttribute("data-label", label);
              span.textContent = `[${label}]`;
              sup.replaceWith(span);
            });

            // 4. Raw unparsed footnote definitions in paragraphs: <p>[^1]: Content</p>
            element.querySelectorAll("p").forEach((p) => {
              const match = p.innerHTML.match(
                /^\s*\[\^([^\]\s]+)\]:\s*([\s\S]+)$/,
              );
              if (match) {
                const div = document.createElement("div");
                div.setAttribute("data-type", "footnoteDefinition");
                div.setAttribute("data-label", match[1]);
                div.innerHTML = match[2].trim();
                p.replaceWith(div);
              }
            });

            // 5. Raw unparsed footnote references in text nodes: [^1]
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
            );
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
              const replaced = val.replace(
                /\[\^([^\]\s]+)\]/g,
                (_, label) =>
                  `<span data-type="footnoteReference" data-label="${label}">[${label}]</span>`,
              );
              if (replaced !== val) {
                const temp = document.createElement("span");
                temp.innerHTML = replaced;
                tn.replaceWith(...Array.from(temp.childNodes));
              }
            }
          },
        },
      },
    };
  },
});
