/* Line-drawn persona avatars from the wireframe: a head and shoulders plus a
   persona prop (code brackets, laptop, headset, hard hat, tie, glasses, pen). */
import type { PersonaId } from "@pfc/scoring";
import type { ReactNode } from "react";

interface AvatarProps {
  pid: PersonaId;
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}

export function Avatar({ pid, size = 44, color = "#fff", className, title }: AvatarProps) {
  const k = size / 44;
  const S = (v: number) => +(v * k).toFixed(2);
  const stroke = { stroke: color, fill: "none", className } as const;

  const props: Record<string, ReactNode> = {
    DEV: (
      <g {...stroke} strokeWidth={S(1.7)} strokeLinecap="round">
        <path d={`M${S(13)},${S(30)} l-${S(4)},${S(3)} l${S(4)},${S(3)}`} />
        <path d={`M${S(31)},${S(30)} l${S(4)},${S(3)} l-${S(4)},${S(3)}`} />
      </g>
    ),
    KW: <path {...stroke} d={`M${S(16)},${S(31)} h${S(12)} v${S(5)} h-${S(12)} z`} strokeWidth={S(1.6)} />,
    CC: (
      <g {...stroke} strokeWidth={S(1.7)} strokeLinecap="round">
        <path d={`M${S(12)},${S(15)} a${S(10)},${S(10)} 0 0 1 ${S(20)},0`} />
        <rect x={S(10)} y={S(14)} width={S(4)} height={S(7)} rx={S(1.6)} />
        <rect x={S(30)} y={S(14)} width={S(4)} height={S(7)} rx={S(1.6)} />
      </g>
    ),
    FIELD: (
      <path
        {...stroke}
        d={`M${S(11)},${S(10)} a${S(11)},${S(11)} 0 0 1 ${S(22)},0 z`}
        strokeWidth={S(1.8)}
        strokeLinejoin="round"
      />
    ),
    EXEC: (
      <path
        {...stroke}
        d={`M${S(22)},${S(23)} l-${S(3)},${S(4)} l${S(3)},${S(9)} l${S(3)},-${S(9)} z`}
        strokeWidth={S(1.6)}
        strokeLinejoin="round"
      />
    ),
    DS: (
      <g {...stroke} strokeWidth={S(1.6)}>
        <circle cx={S(17)} cy={S(14)} r={S(4)} />
        <circle cx={S(27)} cy={S(14)} r={S(4)} />
        <path d={`M${S(21)},${S(14)} h${S(2)}`} />
      </g>
    ),
    CRE: (
      <path
        {...stroke}
        d={`M${S(30)},${S(26)} l${S(5)},-${S(5)} l${S(3)},${S(3)} l-${S(5)},${S(5)} z M${S(30)},${S(26)} l-${S(2)},${S(5)} l${S(5)},-${S(2)}`}
        strokeWidth={S(1.6)}
        strokeLinejoin="round"
      />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0 }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle {...stroke} cx={S(22)} cy={S(14)} r={S(7)} strokeWidth={S(1.9)} />
      <path
        {...stroke}
        d={`M${S(8)},${S(38)} a${S(14)},${S(13)} 0 0 1 ${S(28)},0`}
        strokeWidth={S(1.9)}
        strokeLinecap="round"
      />
      {props[pid] ?? null}
    </svg>
  );
}
