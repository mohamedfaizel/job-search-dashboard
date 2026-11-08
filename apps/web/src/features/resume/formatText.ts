/**
 * Small pure edits to the selected text of a field, as Markdown (the PDF reads **bold**,
 * *italic* and [links](https://…)). Each returns the new value and the new selection.
 */
export interface Edit {
  value: string;
  start: number;
  end: number;
}

interface Field {
  value: string;
  start: number;
  end: number;
}

/** **bold** or *italic* around the selection; used again on the same text it takes them off. */
export function toggleMark({ value, start, end }: Field, mark: '**' | '*'): Edit {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  const m = mark.length;
  // A single * must not match one half of a **.
  const marked =
    mark === '*'
      ? /(?<!\*)\*$/.test(before) && /^\*(?!\*)/.test(after)
      : before.endsWith('**') && after.startsWith('**');
  if (marked) {
    return {
      value: before.slice(0, -m) + selected + after.slice(m),
      start: start - m,
      end: end - m,
    };
  }
  const inside =
    selected.length > 2 * m &&
    selected.startsWith(mark) &&
    selected.endsWith(mark) &&
    (mark === '**' || !selected.startsWith('**'));
  if (inside) {
    const plain = selected.slice(m, -m);
    return { value: before + plain + after, start, end: start + plain.length };
  }
  return { value: before + mark + selected + mark + after, start: start + m, end: end + m };
}

/** [selected text](url); with nothing selected the link text is the address. */
export function addLink({ value, start, end }: Field, url: string): Edit {
  const address = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
  const text = value.slice(start, end) || url.replace(/^https?:\/\//i, '');
  const link = `[${text}](${address})`;
  return {
    value: value.slice(0, start) + link + value.slice(end),
    start,
    end: start + link.length,
  };
}

/** Takes the Markdown away from the whole field (bold, italic and links). */
export function clearMarks({ value, end }: Field): Edit {
  const plain = value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(
      /\*\*(.+?)\*\*|__(.+?)__/g,
      (_, a: string | undefined, b: string | undefined) => a ?? b ?? '',
    )
    .replace(/(?<![\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1');
  const at = Math.min(plain.length, end);
  return { value: plain, start: at, end: at };
}
