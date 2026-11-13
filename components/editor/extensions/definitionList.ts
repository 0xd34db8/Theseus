import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";

/**
 * Definition List nodes (<dl>, <dt>, <dd>)
 */
export const DefinitionList = TiptapNode.create({
  name: "definitionList",
  group: "block",
  content: "(definitionTerm | definitionDescription)+",
  parseHTML() {
    return [{ tag: "dl" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "dl",
      mergeAttributes(HTMLAttributes, { class: "theseus-definition-list" }),
      0,
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderContent(node);
          state.write("\n");
        },
      },
    };
  },
});

export const DefinitionTerm = TiptapNode.create({
  name: "definitionTerm",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "dt" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "dt",
      mergeAttributes(HTMLAttributes, { class: "theseus-definition-term" }),
      0,
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderInline(node);
          state.write("\n");
        },
      },
    };
  },
});

export const DefinitionDescription = TiptapNode.create({
  name: "definitionDescription",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [
      {
        tag: "dd",
        contentElement: (element) => element.querySelector("p") ?? element,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "dd",
      mergeAttributes(HTMLAttributes, { class: "theseus-definition-desc" }),
      0,
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(": ");
          state.renderInline(node);
          state.write("\n\n");
        },
      },
    };
  },
});
