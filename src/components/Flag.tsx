import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";

function star(cx: number, cy: number, r: number, rotate = 0) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.382;
    const angle = ((i * 36 - 90 + rotate) * Math.PI) / 180;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return points.join(" ");
}

const flags: Record<Locale, ReactNode> = {
  en: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="13" height={(7 * 20) / 13} fill="#3c3b6e" />
      {[2, 5, 8, 11].map((x) => [2.2, 5.4, 8.6].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#fff" />))}
    </>
  ),
  fr: (
    <>
      <rect width="10" height="20" fill="#002654" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ed2939" />
    </>
  ),
  es: (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </>
  ),
  pt: (
    <>
      <rect width="30" height="20" fill="#009c3b" />
      <polygon points="15,2.2 27.6,10 15,17.8 2.4,10" fill="#ffdf00" />
      <circle cx="15" cy="10" r="4.6" fill="#002776" />
      <path d="M10.6 9.1c2.9-.5 6.2.1 8.8 1.8" stroke="#fff" strokeWidth="0.9" fill="none" />
    </>
  ),
  de: (
    <>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </>
  ),
  ru: (
    <>
      <rect width="30" height="6.67" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039a6" />
      <rect y="13.33" width="30" height="6.67" fill="#d52b1e" />
    </>
  ),
  hi: (
    <>
      <rect width="30" height="6.67" fill="#ff9933" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <g stroke="#000080" fill="none">
        <circle cx="15" cy="10" r="2.6" strokeWidth="0.45" />
        <g strokeWidth="0.18"><line x1="15" y1="10" x2="17.60" y2="10.00" /><line x1="15" y1="10" x2="17.51" y2="10.67" /><line x1="15" y1="10" x2="17.25" y2="11.30" /><line x1="15" y1="10" x2="16.84" y2="11.84" /><line x1="15" y1="10" x2="16.30" y2="12.25" /><line x1="15" y1="10" x2="15.67" y2="12.51" /><line x1="15" y1="10" x2="15.00" y2="12.60" /><line x1="15" y1="10" x2="14.33" y2="12.51" /><line x1="15" y1="10" x2="13.70" y2="12.25" /><line x1="15" y1="10" x2="13.16" y2="11.84" /><line x1="15" y1="10" x2="12.75" y2="11.30" /><line x1="15" y1="10" x2="12.49" y2="10.67" /><line x1="15" y1="10" x2="12.40" y2="10.00" /><line x1="15" y1="10" x2="12.49" y2="9.33" /><line x1="15" y1="10" x2="12.75" y2="8.70" /><line x1="15" y1="10" x2="13.16" y2="8.16" /><line x1="15" y1="10" x2="13.70" y2="7.75" /><line x1="15" y1="10" x2="14.33" y2="7.49" /><line x1="15" y1="10" x2="15.00" y2="7.40" /><line x1="15" y1="10" x2="15.67" y2="7.49" /><line x1="15" y1="10" x2="16.30" y2="7.75" /><line x1="15" y1="10" x2="16.84" y2="8.16" /><line x1="15" y1="10" x2="17.25" y2="8.70" /><line x1="15" y1="10" x2="17.51" y2="9.33" /></g>
      </g>
      <circle cx="15" cy="10" r="0.5" fill="#000080" />
    </>
  ),
  ja: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </>
  ),
  ko: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <g transform="rotate(33.7 15 10)">
        <path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z" fill="#cd2e3a" />
        <path d="M20 10a5 5 0 0 1-10 0a2.5 2.5 0 0 1 5 0a2.5 2.5 0 0 0 5 0z" fill="#0047a0" />
      </g>
      {[
        [5.2, 4.2, 33.7],
        [24.8, 15.8, 33.7],
        [24.8, 4.2, -33.7],
        [5.2, 15.8, -33.7],
      ].map(([x, y, a]) => (
        <g key={`${x}-${y}`} transform={`rotate(${a} ${x} ${y})`} fill="#000">
          <rect x={x - 2.5} y={y - 2} width="5" height="0.9" />
          <rect x={x - 2.5} y={y - 0.45} width="5" height="0.9" />
          <rect x={x - 2.5} y={y + 1.1} width="5" height="0.9" />
        </g>
      ))}
    </>
  ),
  zh: (
    <>
      <rect width="30" height="20" fill="#de2910" />
      <polygon points={star(5, 5, 3)} fill="#ffde00" />
      <polygon points={star(10, 2, 1, 23)} fill="#ffde00" />
      <polygon points={star(12, 4, 1, 45)} fill="#ffde00" />
      <polygon points={star(12, 7, 1, 70)} fill="#ffde00" />
      <polygon points={star(10, 9, 1, 20)} fill="#ffde00" />
    </>
  ),
};

export function Flag({ locale }: { locale: Locale }) {
  return (
    <svg className="flag" viewBox="0 0 30 20" aria-hidden="true">
      {flags[locale]}
    </svg>
  );
}
