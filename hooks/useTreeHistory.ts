import { useState, useCallback } from "react";
import { SyllabusItem, TopicNote, TopicStatus } from "@/types/syllabus";

interface TreeSnapshotNode {
  id: string;
  title: string;
  status: TopicStatus;
  isExpanded?: boolean;
  hasNote?: boolean;
  note?: TopicNote;
  children?: TreeSnapshotNode[];
}

function extractTreeSnapshot(items: SyllabusItem[]): TreeSnapshotNode[] {
  return items.map((it) => ({
    id: it.id,
    title: it.title,
    status: it.status,
    isExpanded: it.isExpanded,
    hasNote: it.hasNote,
    note: it.note,
    children: it.children ? extractTreeSnapshot(it.children) : undefined,
  }));
}

function restoreTreeFromSnapshot(
  snapshot: TreeSnapshotNode[],
  currentItems: SyllabusItem[],
): SyllabusItem[] {
  const notesMap = new Map<string, { note?: TopicNote; hasNote: boolean }>();
  function collect(items: SyllabusItem[]) {
    for (const it of items) {
      if (it.note || it.hasNote) {
        notesMap.set(it.id, { note: it.note, hasNote: it.hasNote });
      }
      if (it.children) collect(it.children);
    }
  }
  collect(currentItems);

  function apply(nodes: TreeSnapshotNode[]): SyllabusItem[] {
    return nodes.map((n) => {
      // Keep the latest note for surviving topics so tree undo/redo never discards editor edits.
      const currentSaved = notesMap.get(n.id);
      const hasNote =
        currentSaved !== undefined ? currentSaved.hasNote : Boolean(n.hasNote);
      const note = currentSaved !== undefined ? currentSaved.note : n.note;

      return {
        id: n.id,
        title: n.title,
        status: n.status,
        isExpanded: n.isExpanded ?? true,
        hasNote,
        note,
        children: n.children ? apply(n.children) : undefined,
      };
    });
  }

  return apply(snapshot);
}

/**
 * Manages structural undo/redo history for the syllabus tree while preserving note content.
 */
export function useTreeHistory(
  onApplyItems: (restoredItems: SyllabusItem[]) => void,
) {
  const [historyPast, setHistoryPast] = useState<TreeSnapshotNode[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<TreeSnapshotNode[][]>([]);

  const pushTreeHistory = useCallback((currentItems: SyllabusItem[]) => {
    const snapshot = extractTreeSnapshot(currentItems);
    setHistoryPast((prev) => [snapshot, ...prev.slice(0, 49)]);
    setHistoryFuture([]);
  }, []);

  const undo = useCallback(
    (currentItems: SyllabusItem[]) => {
      if (historyPast.length === 0) return;
      const [prevSnapshot, ...remainingPast] = historyPast;
      setHistoryFuture((prev) => [extractTreeSnapshot(currentItems), ...prev]);
      setHistoryPast(remainingPast);
      onApplyItems(restoreTreeFromSnapshot(prevSnapshot, currentItems));
    },
    [historyPast, onApplyItems],
  );

  const redo = useCallback(
    (currentItems: SyllabusItem[]) => {
      if (historyFuture.length === 0) return;
      const [nextSnapshot, ...remainingFuture] = historyFuture;
      setHistoryPast((prev) => [extractTreeSnapshot(currentItems), ...prev]);
      setHistoryFuture(remainingFuture);
      onApplyItems(restoreTreeFromSnapshot(nextSnapshot, currentItems));
    },
    [historyFuture, onApplyItems],
  );

  return {
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    pushTreeHistory,
    undo,
    redo,
  };
}
