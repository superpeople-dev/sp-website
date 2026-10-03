// The leaderboard's mode and view switches with pictures, like the game's lobby: one figure for Solo up
// to four for Squad, a shooter seen from behind for TPP and a gun in hand for FPP.
import type { LeaderMode, LeaderView } from "@/lib/leaderboard";

const figures: Record<LeaderMode, number> = { solo: 1, duo: 2, trio: 3, squad: 4 };

// One figure: head and shoulders, 10 units wide; the next one overlaps by 3.
const figure = "M5 1.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 0 1 0-5.2ZM0.4 14c0-3.4 2-5.6 4.6-5.6s4.6 2.2 4.6 5.6Z";

export function ModeIcon({ mode }: { mode: LeaderMode }) {
  const n = figures[mode];
  const width = 10 + (n - 1) * 7;
  return (
    <svg className="mode-icon" viewBox={`0 0 ${width} 14`} width={(width / 14) * 16} height={16} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={figure} transform={`translate(${i * 7} 0)`} />
      ))}
    </svg>
  );
}

const views: Record<LeaderView, string> = {
  // A kneeling shooter aiming a rifle, seen from the side and behind.
  tpp: "M7.5 1.5a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 0 1 0-4.6ZM5 7.2h4.6l1.4 2.2h8.5v1.6h-8.3l-1.6 1.2v2.4l2.4 3.4h-2.2l-2.3-3H6.4L5.3 19H3.2l1.4-5.4C3.6 12.4 3.6 9 5 7.2Z",
  // A hand holding a pistol, seen through the eyes.
  fpp: "M9 4.5h10.5v3.2H17l-.6 1.8h-3.2l-.5 1.6H11l-1.3 5.4c-.2.9-1 1.5-1.9 1.5H5.6l2-8.2L6.8 7.4 9 4.5Zm2.2 6.6h1.3l.3-1h-1.3Z",
};

export function ViewIcon({ view }: { view: LeaderView }) {
  return (
    <svg className="mode-icon" viewBox="0 0 20 20" width={18} height={18} aria-hidden="true">
      <path d={views[view]} />
    </svg>
  );
}
