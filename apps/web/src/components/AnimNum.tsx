/* A number that counts up from zero when it first appears (if MOTION is on).
   React never owns the text node: the effect writes it, so D3's tween and
   React re-renders cannot fight over the same DOM node. */
import { easeCubicOut, select } from "d3";
import { useLayoutEffect, useRef } from "react";
import { formatNum } from "../lib/format.ts";
import { useUi } from "../store/ui.ts";

interface AnimNumProps {
  value: number;
  /** Decimal places; 0 formats with thousands separators. */
  dec?: number;
  pre?: string;
  suf?: string;
}

export function AnimNum({ value, dec = 0, pre = "", suf = "" }: AnimNumProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motion = useUi((s) => s.motion);
  const played = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const text = (v: number) => pre + formatNum(v, dec) + suf;
    const sel = select(el);
    sel.interrupt("num");
    if (motion && !played.current && Number.isFinite(value)) {
      el.textContent = text(0);
      sel
        .transition("num")
        .duration(900)
        .ease(easeCubicOut)
        .tween("n", () => (t) => {
          el.textContent = text(value * t);
        });
    } else {
      el.textContent = text(value);
    }
    played.current = true;
  }, [value, dec, pre, suf, motion]);

  return <span ref={ref} className="anim-num" data-value={value} />;
}
