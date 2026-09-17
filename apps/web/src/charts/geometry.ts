import { arc, type DefaultArcObject } from "d3-shape";

export const MONO = 'ui-monospace,SFMono-Regular,"JetBrains Mono",Menlo,monospace';

/** SVG path for an annular sector, as d3.arc draws it. */
export function arcPath(inner: number, outer: number, corner: number, a0: number, a1: number): string {
  const gen = arc<DefaultArcObject>().innerRadius(inner).outerRadius(outer).cornerRadius(corner);
  return gen({ startAngle: a0, endAngle: a1 } as DefaultArcObject) ?? "";
}
