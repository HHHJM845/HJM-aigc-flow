/**
 * 将文本按双换行分段，过滤空段落
 */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

/**
 * LCS-based paragraph diff.
 * 返回在 newParagraphs 中相对于 oldParagraphs 新增或修改的段落。
 * 策略：完全相同的段落视为未变，其余视为变动。
 */
export function diffParagraphs(
  oldParagraphs: string[],
  newParagraphs: string[]
): { changed: string[]; unchangedSet: Set<string> } {
  const oldSet = new Set(oldParagraphs);
  const changed: string[] = [];
  const unchangedSet = new Set<string>();

  for (const p of newParagraphs) {
    if (oldSet.has(p)) {
      unchangedSet.add(p);
    } else {
      changed.push(p);
    }
  }

  return { changed, unchangedSet };
}

/**
 * 合并重拆结果到现有 rows。
 * - 找到 sourceSegment 属于 changedSegments 的旧 rows，用新 rows 替换
 * - 纯新增段落（旧 rows 里没有对应 sourceSegment）的新 rows 追加到末尾
 * - 重新编号 index
 */
export function mergeRows<T extends { id: string; index: number; sourceSegment?: string }>(
  existingRows: T[],
  newRows: T[],
  changedSegments: string[]
): T[] {
  const changedSet = new Set(changedSegments);

  // 保留 sourceSegment 不在 changedSegments 里的旧 rows
  const keptRows = existingRows.filter(r => !changedSet.has(r.sourceSegment ?? ''));

  // 新 rows 里，sourceSegment 已在旧 rows 中有对应的 → 替换；否则 → 追加
  const existingSegments = new Set(existingRows.map(r => r.sourceSegment ?? ''));
  const replacementRows = newRows.filter(r => existingSegments.has(r.sourceSegment ?? '') || changedSet.has(r.sourceSegment ?? ''));
  const appendRows = newRows.filter(r => !existingSegments.has(r.sourceSegment ?? '') && !changedSet.has(r.sourceSegment ?? ''));

  const merged = [...keptRows, ...replacementRows, ...appendRows];
  return merged.map((r, i) => ({ ...r, index: i + 1 }));
}
