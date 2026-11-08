import type { DragEvent } from 'react';
import { useState } from 'react';

/** What is being dragged right now. One at a time, so a module variable is enough. */
let dragging: { scope: string; index: number } | null = null;

/**
 * Drag to reorder: the grip starts the drag, any row of the same list takes the drop. `scope`
 * keeps lists apart, so a bullet can't land among sections.
 */
export function useDragSort(scope: string, onMove: (from: number, to: number) => void) {
  const [over, setOver] = useState<number | null>(null);

  const grip = (index: number) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      dragging = { scope, index };
      event.dataTransfer.effectAllowed = 'move';
      // Firefox only drags with some data set.
      event.dataTransfer.setData('text/plain', String(index));
      const row = event.currentTarget.closest('[data-drag-row]');
      if (row instanceof HTMLElement) event.dataTransfer.setDragImage(row, 16, 16);
    },
    onDragEnd: () => {
      dragging = null;
      setOver(null);
    },
  });

  const row = (index: number) => ({
    'data-drag-row': true,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (dragging?.scope !== scope) return;
      event.preventDefault();
      event.stopPropagation();
      if (over !== index) setOver(index);
    },
    onDragLeave: () => {
      if (over === index) setOver(null);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (dragging?.scope !== scope) return;
      event.preventDefault();
      event.stopPropagation();
      onMove(dragging.index, index);
      dragging = null;
      setOver(null);
    },
  });

  return { grip, row, over };
}
