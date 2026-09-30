import type { SVGProps } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const paths = {
  download: <path {...stroke} d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16" />,
  share: (
    <g {...stroke}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </g>
  ),
  code: <path {...stroke} strokeWidth={2} d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
  layers: <path {...stroke} strokeWidth={2} d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />,
  upload: <path {...stroke} strokeWidth={2} d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" />,
  clock: (
    <g {...stroke} strokeWidth={2.2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </g>
  ),
  check: <path {...stroke} strokeWidth={3} d="M5 12.5l4.5 4.5L19 7.5" />,
  menu: <path {...stroke} d="M4 7h16M4 12h16M4 17h16" />,
  close: <path {...stroke} d="M6 6l12 12M18 6 6 18" />,
  globe: (
    <g {...stroke} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </g>
  ),
  steam: <path fill="currentColor" d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />,
  // Tux, one colour: body, then the belly, eyes and beak cut out of it, and the feet.
  linux: (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 1.8c-2.6 0-4.1 2.2-4.1 5 0 1.3.2 2.2-.7 3.7C5.8 12.6 4.3 15 4.3 17.3c0 1 .3 1.8.8 2.4h13.8c.5-.6.8-1.4.8-2.4 0-2.3-1.5-4.7-2.9-6.8-.9-1.5-.7-2.4-.7-3.7 0-2.8-1.5-5-4.1-5ZM12 11.2c-2 0-3.6 2.4-3.6 5.2 0 1.2.3 2.2.8 2.9h5.6c.5-.7.8-1.7.8-2.9 0-2.8-1.6-5.2-3.6-5.2ZM10.6 5.3a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Zm2.8 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8ZM10.8 8.1h2.4L12 9.6Z M3.8 20.7c0-.9 1.9-1.7 3.8-1.7 1.4 0 2.6.8 2.6 1.7s-1.5 1.6-3.2 1.6c-1.7 0-3.2-.7-3.2-1.6Zm10 0c0-.9 1.2-1.7 2.6-1.7 1.9 0 3.8.8 3.8 1.7s-1.5 1.6-3.2 1.6c-1.7 0-3.2-.7-3.2-1.6Z"
    />
  ),
  windows: (
    <g fill="currentColor">
      <rect x="2.5" y="2.5" width="8.8" height="8.8" rx="0.6" />
      <rect x="12.7" y="2.5" width="8.8" height="8.8" rx="0.6" />
      <rect x="2.5" y="12.7" width="8.8" height="8.8" rx="0.6" />
      <rect x="12.7" y="12.7" width="8.8" height="8.8" rx="0.6" />
    </g>
  ),
  drive: (
    <g {...stroke} strokeWidth={2}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 14h.01M11 14h6" />
    </g>
  ),
  chevron: <path {...stroke} strokeWidth={2.2} d="m6 9 6 6 6-6" />,
  search: <path {...stroke} strokeWidth={2} d="M10.5 17.5a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM15.6 15.6 20.5 20.5" />,
  filter: <path {...stroke} strokeWidth={2} d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z" />,
  left: <path {...stroke} d="m15 18-6-6 6-6" />,
  right: <path {...stroke} d="m9 18 6-6-6-6" />,
  up: <path {...stroke} strokeWidth={2.6} d="m6 15 6-6 6 6" />,
  // Reddit's vote arrow, outlined (filled in CSS once you voted); pointed down by rotating it.
  vote: <path {...stroke} strokeWidth={1.8} d="M12 3.5 4.5 11.5H9V20h6v-8.5h4.5L12 3.5Z" />,
  // A filled circle with the i cut out of it (the background shows through).
  info: <path fill="currentColor" fillRule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20ZM10.6 10.4h2.8v7.4h-2.8ZM12 5.6a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Z" />,
  bell: <path {...stroke} strokeWidth={2} d="M6 8.5a6 6 0 1 1 12 0c0 6.5 3 8.5 3 8.5H3s3-2 3-8.5ZM10.3 20.5a2 2 0 0 0 3.4 0" />,
  // The same arrow, pointing down: flipped in the drawing, not with a CSS transform.
  voteDown: <path {...stroke} strokeWidth={1.8} d="M12 20.5 19.5 12.5H15V4H9v8.5H4.5L12 20.5Z" />,
  bug: <path {...stroke} strokeWidth={2} d="M8 8.5V7a4 4 0 0 1 8 0v1.5M6.5 9h11v5a5.5 5.5 0 0 1-11 0V9ZM12 12v7M3 13h3.5M17.5 13H21M4 8l2.5 1.5M20 8l-2.5 1.5M4 19l2.8-1.8M20 19l-2.8-1.8" />,
  sparkle: <path {...stroke} strokeWidth={2} d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.2l-1.8-5.6-5.7-1.8L10.2 9 12 3.5ZM18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />,
  trend: <path {...stroke} strokeWidth={2} d="M3.5 17 9 11.5l4 4 7.5-7.5M15 8h5.5v5.5" />,
  question: <path {...stroke} strokeWidth={2} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4M12 17.3h.01" />,
  todo: <path {...stroke} strokeWidth={2} d="M9 3.5h6v3H9zM7 5H5.5v15.5h13V5H17M9 11h6M9 15h4" />,
  wrench: <path {...stroke} strokeWidth={2} d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5.8 5.8 3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.5-.5-2.1 2.5-2.5Z" />,
  other: <path {...stroke} strokeWidth={2} d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />,
  send: <path {...stroke} strokeWidth={2} d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />,
  shield: <path {...stroke} strokeWidth={2} d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.8 7 9 4.1-1.2 7-4.7 7-9V6.2L12 3.5ZM9 12l2.2 2.2L15.5 10" />,
  plus: <path {...stroke} strokeWidth={2} d="M12 5v14M5 12h14" />,
  more: (
    <g fill="currentColor">
      <circle cx="5.5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18.5" cy="12" r="1.9" />
    </g>
  ),
  attach: (
    <path
      {...stroke}
      strokeWidth={2}
      d="m20.5 11.5-8.3 8.3a5 5 0 0 1-7-7l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"
    />
  ),
  play: <path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.9l10.3-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" />,
  // A line chart: a server's history (Servers page).
  chart: <path {...stroke} strokeWidth={2} d="M4 4v16h16M7.5 15l3.5-4 3 3 5-6.5" />,
  // A pulse line: the admin panel's activity log.
  activity: <path {...stroke} strokeWidth={2} d="M2.5 12h4l2.8-7 5.4 14 2.8-7h4" />,
  server: (
    <g {...stroke} strokeWidth={2}>
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.5" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5" />
      <path d="M7.5 7.25h.01M7.5 16.75h.01M11 7.25h.01M11 16.75h.01" />
    </g>
  ),
  gamepad: (
    <path
      {...stroke}
      strokeWidth={2}
      d="M7.5 7.5h9a4.5 4.5 0 0 1 4.4 5.5l-.6 2.9a2.6 2.6 0 0 1-4.6 1l-1.3-1.9h-4.8l-1.3 1.9a2.6 2.6 0 0 1-4.6-1l-.6-2.9a4.5 4.5 0 0 1 4.4-5.5ZM8 10.5v3M6.5 12h3M15.5 11h.01M17 13h.01"
    />
  ),
  rocket: (
    <path
      {...stroke}
      strokeWidth={2}
      d="M14.5 4.5c2-1.2 4-1.3 5-1.2.1 1 0 3-1.2 5l-5.8 5.8-3.6-3.6 5.6-6ZM9.3 9.9 5.5 9.5 3.5 11.5l4 1.4M14.1 14.7l.4 3.8-2 2-1.4-4M6.8 16.3c-1.3.4-2.3 1.8-2.3 3.2 1.4 0 2.8-1 3.2-2.3M15 9h.01"
    />
  ),
  tag: <path {...stroke} strokeWidth={2} d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2-8.8 8.8-8.2-8.2ZM8.5 8.5h.01" />,
  edit: <path {...stroke} strokeWidth={2} d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />,
  trash: <path {...stroke} strokeWidth={2} d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" />,
  ban: (
    <g {...stroke} strokeWidth={2}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </g>
  ),
  home: <path {...stroke} strokeWidth={2} d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" />,
  bulb: <path {...stroke} strokeWidth={2} d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3Z" />,
  board: <path {...stroke} strokeWidth={2} d="M4 4.5h4v15H4zM10 4.5h4v10h-4zM16 4.5h4v6h-4z" />,
  done: <path {...stroke} strokeWidth={2} d="M20 12a8 8 0 1 1-8-8M8.5 11.5l3 3L20 6" />,
  comment: <path {...stroke} strokeWidth={2} d="M20 11.5a7.5 7.5 0 0 1-10.8 6.7L4.5 19.5l1.3-4.2A7.5 7.5 0 1 1 20 11.5Z" />,
  lock: <path {...stroke} strokeWidth={2} d="M5.5 10.5h13v10h-13zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2" />,
  logout: <path {...stroke} strokeWidth={2} d="M15 16.5 19.5 12 15 7.5M19.5 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />,
  discord: (
    <path
      fill="currentColor"
      d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 .1 13.6.3 18.1A19.8 19.8 0 0 0 6.3 21l1.3-2c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.4-5.2-.8-9.8-3.4-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z"
    />
  ),
  github: (
    <path
      fill="currentColor"
      d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z"
    />
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
