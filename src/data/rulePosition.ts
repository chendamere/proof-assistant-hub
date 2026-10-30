/**
 * Citation order overrides. Theorem ids stay in their source file.
 * Node id operator is written in the connectivity chapter, and chapter 8 uses it.
 */
export function earlyRulePosition(ruleId: string, chapterOrder: readonly string[]): number | null {
  if (ruleId !== 'rules-of-node-connectivity-199-idmmnsj') return null;
  const chapter8 = chapterOrder.indexOf('Theorems_of_Operators_and_Relationships');
  if (chapter8 < 0) return null;
  return chapter8 * 100000 - 1;
}
