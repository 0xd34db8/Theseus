import { Node as TiptapNode, mergeAttributes, InputRule } from "@tiptap/core";

/**
 * Footnote Reference inline node: [^1]
 */
export const FootnoteReference = TiptapNode.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (el) => {
          return (
            el.getAttribute("data-label") ||
            el.textContent?.replace(/[\[\]\^]/g, "").trim() ||
            "1"
          );
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="footnoteReference"]',
      },
      {
        tag: "sup.footnote-ref",
      },
      {
        tag: "sup[data-footnote-ref]",
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = node.attrs.label || "1";
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        class: "theseus-footnote-ref",
        "data-type": "footnoteReference",
        "data-label": label,
      }),
      `[${label}]`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`[^${node.attrs.label || "1"}]`);
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\^([^\]\s]+)\]$/,
        handler: (props) => {
          const label = props.match[1];
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { label } },
            )
            .run();
        },
      }),
    ];
  },
});

/**
 * Footnote Definition block node: [^1]: Definition text
 */
export const FootnoteDefinition = TiptapNode.create({
  name: "footnoteDefinition",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (el) => {
          return el.getAttribute("data-label") || "1";
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="footnoteDefinition"]',
      },
      {
        tag: "li.footnote-item",
        getAttrs: (el) => {
          if (el instanceof HTMLElement) {
            const rawId = el.getAttribute("id") || "";
            return { label: rawId.replace(/^fn/, "") || "1" };
          }
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = node.attrs.label || "1";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "theseus-footnote-definition",
        "data-type": "footnoteDefinition",
        "data-label": label,
      }),
      [
        "span",
        {
          class: "theseus-footnote-label",
          contenteditable: "false",
        },
        `[^${label}]:`,
      ],
      ["div", { class: "theseus-footnote-body" }, 0],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`[^${node.attrs.label || "1"}]: `);
          state.renderInline(node);
          state.write("\n\n");
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\[\^([^\]\s]+)\]:\s$/,
        handler: (props) => {
          const label = props.match[1];
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              { type: this.name, attrs: { label } },
            )
            .run();
        },
      }),
    ];
  },
});
