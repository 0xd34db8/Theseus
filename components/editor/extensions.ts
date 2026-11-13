import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import type { AnyExtension } from "@tiptap/core";

import { MathNode } from "./MathNode";
import { YoutubeNode } from "./YoutubeNode";
import {
  DefinitionList,
  DefinitionTerm,
  DefinitionDescription,
} from "./extensions/definitionList";
import { FootnoteReference, FootnoteDefinition } from "./extensions/footnote";
import { MarkdownPlugins } from "./extensions/markdownPlugins";
import {
  SearchHighlight,
  SearchHighlightPluginKey,
} from "./extensions/searchHighlight";
import {
  CustomCodeBlock,
  CustomTaskList,
  CustomTaskItem,
  CustomImage,
  CustomUnderline,
  CustomHighlight,
  CustomFontSize,
  CustomShortcuts,
} from "./extensions/formattingMarks";

export {
  MathNode,
  YoutubeNode,
  Superscript,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  DefinitionList,
  DefinitionTerm,
  DefinitionDescription,
  FootnoteReference,
  FootnoteDefinition,
  MarkdownPlugins,
  SearchHighlight,
  SearchHighlightPluginKey,
  CustomCodeBlock,
  CustomTaskList,
  CustomTaskItem,
  CustomImage,
  CustomUnderline,
  CustomHighlight,
  CustomFontSize,
  CustomShortcuts,
};

/**
 * Extracts serialized Markdown from a TipTap editor instance safely.
 */
export const getEditorMarkdown = (editor: any): string => {
  if (!editor) return "";
  return (editor.storage as any)?.markdown?.getMarkdown?.() ?? "";
};

export interface CreateTipTapExtensionsOptions {
  placeholder?: string;
  headingLevels?: (1 | 2 | 3 | 4 | 5 | 6)[];
  withImages?: boolean;
  withSearchHighlight?: boolean;
  extraExtensions?: AnyExtension[];
}

/**
 * Shared TipTap extension stack used by both the main NoteEditor and SubsectionsDrawer.
 */
export function createTipTapExtensions(
  options?: CreateTipTapExtensionsOptions,
): AnyExtension[] {
  const withImages = options?.withImages ?? false;
  const exts: AnyExtension[] = [
    StarterKit.configure({
      link: false,
      underline: false,
      codeBlock: false,
      heading: {
        levels: options?.headingLevels ?? [1, 2, 3, 4, 5, 6],
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),
    CustomCodeBlock,
    FootnoteReference,
    FootnoteDefinition,
    CustomUnderline,
    CustomHighlight.configure({
      multicolor: false,
    }),
    CustomFontSize,
    CustomTaskList,
    CustomTaskItem.configure({
      nested: true,
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: "theseus-editor-table",
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    MathNode,
    YoutubeNode,
    Superscript,
    DefinitionList,
    DefinitionTerm,
    DefinitionDescription,
    MarkdownPlugins,
    TextAlign.configure({
      types: withImages ? ["heading", "paragraph", "image"] : ["heading", "paragraph"],
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: "-",
      transformPastedText: true,
      transformCopiedText: true,
    }),
    CustomShortcuts,
  ];

  if (options?.placeholder) {
    exts.push(
      Placeholder.configure({
        placeholder: options.placeholder,
      }),
    );
  }

  if (withImages) {
    exts.push(
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
    );
  }

  if (options?.withSearchHighlight) {
    exts.push(SearchHighlight);
  }

  if (options?.extraExtensions?.length) {
    exts.push(...options.extraExtensions);
  }

  return exts;
}
