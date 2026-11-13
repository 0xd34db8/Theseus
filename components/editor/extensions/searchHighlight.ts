import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as PMNode } from "@tiptap/pm/model";

export const SearchHighlightPluginKey = new PluginKey("searchHighlight");

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchPluginState {
  searchTerm: string;
  currentIndex: number;
  matches: SearchMatch[];
  decorations: DecorationSet;
}

function computeSearchState(
  doc: PMNode,
  term: string,
  targetIndex: number,
): SearchPluginState {
  const clean = term.trim().toLowerCase();
  if (!clean) {
    return {
      searchTerm: "",
      currentIndex: 0,
      matches: [],
      decorations: DecorationSet.empty,
    };
  }

  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase();
      let idx = text.indexOf(clean);
      while (idx !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + clean.length });
        idx = text.indexOf(clean, idx + clean.length);
      }
    }
  });

  let currentIndex = 0;
  if (matches.length > 0) {
    if (targetIndex >= 0 && targetIndex < matches.length) {
      currentIndex = targetIndex;
    } else if (targetIndex < 0) {
      currentIndex = matches.length - 1;
    }
  }

  const decorations = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class:
        i === currentIndex
          ? "editor-search-match editor-search-match-active"
          : "editor-search-match",
    }),
  );

  return {
    searchTerm: term,
    currentIndex,
    matches,
    decorations: DecorationSet.create(doc, decorations),
  };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      nextSearchMatch: () => ReturnType;
      prevSearchMatch: () => ReturnType;
    };
  }
}

/**
 * Live in-editor search highlight & navigation extension.
 */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SearchHighlightPluginKey, {
              type: "setTerm",
              term: searchTerm,
            });
          }
          return true;
        },
      nextSearchMatch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SearchHighlightPluginKey, { type: "next" });
          }
          return true;
        },
      prevSearchMatch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SearchHighlightPluginKey, { type: "prev" });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SearchHighlightPluginKey,
        state: {
          init(_, state): SearchPluginState {
            return computeSearchState(state.doc, "", 0);
          },
          apply(
            tr,
            prev: SearchPluginState,
            _oldState,
            newState,
          ): SearchPluginState {
            const meta = tr.getMeta(SearchHighlightPluginKey);
            if (meta) {
              if (meta.type === "setTerm") {
                return computeSearchState(newState.doc, meta.term, 0);
              }
              if (meta.type === "next") {
                const nextIdx =
                  prev.matches.length > 0
                    ? (prev.currentIndex + 1) % prev.matches.length
                    : 0;
                return computeSearchState(
                  newState.doc,
                  prev.searchTerm,
                  nextIdx,
                );
              }
              if (meta.type === "prev") {
                const prevIdx =
                  prev.matches.length > 0
                    ? (prev.currentIndex - 1 + prev.matches.length) %
                      prev.matches.length
                    : 0;
                return computeSearchState(
                  newState.doc,
                  prev.searchTerm,
                  prevIdx,
                );
              }
            }
            if (tr.docChanged) {
              return computeSearchState(
                newState.doc,
                prev.searchTerm,
                prev.currentIndex,
              );
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            const pluginState = SearchHighlightPluginKey.getState(state);
            return pluginState ? pluginState.decorations : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
