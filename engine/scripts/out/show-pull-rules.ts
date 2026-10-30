import { theorems } from '../../../src/data/theorems';
for (const t of theorems) {
  if (
    /identical-node-comparison-15|null-comparison-9-|identical-node-comparison-21|empty-branch-function-1/.test(
      t.id
    )
  ) {
    console.log(t.id);
    console.log(' L', t.leftSide);
    console.log(' R', t.rightSide);
  }
}
