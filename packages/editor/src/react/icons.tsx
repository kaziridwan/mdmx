/** Small inline icons (no dependency), shared by the sidebar tabs and FABs. */

type IconProps = { size?: number };

const base = (size: number) => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** Source / code (`</>`). */
export function CodeIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

/** Properties / sliders. */
export function SlidersIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/** Components palette / layers. */
export function LayersIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

/** Mobile viewport preview. */
export function SmartphoneIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

/** Tablet viewport preview. */
export function TabletIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

/** Desktop viewport preview. */
export function MonitorIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

/** Fit-to-pane viewport (the default): the canvas takes the pane's width. */
export function FitIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="9 3 3 3 3 9" />
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <polyline points="15 21 21 21 21 15" />
    </svg>
  );
}

/** Left panel (the component rail) toggle. */
export function PanelLeftIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

/** Right panel (the Source/Properties sidebar) toggle. */
export function PanelRightIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

/** Block actions: move up. */
export function ArrowUpIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

/** Block actions: move down. */
export function ArrowDownIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

/** Block actions: duplicate. */
export function CopyIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Block actions: delete. */
export function TrashIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
