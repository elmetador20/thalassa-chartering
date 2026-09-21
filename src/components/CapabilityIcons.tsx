import React from 'react';

// ============================================================================
// Capability icon set.
//
// Hairline technical line-work on a 26×26 grid — the drawing style used by
// serious industrial and consulting firms: single colour, thin even stroke,
// round caps, no fills and no decoration. Sized by the consumer via `size`.
//
// `iconFor()` maps a capability label to the closest mark so the content file
// stays free of presentation concerns.
// ============================================================================

export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 26 26',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

const s = {
  stroke: 'currentColor',
  strokeWidth: 1.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* ------------------------------------------------------- intelligence -- */

export const Compass = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="13" cy="13" r="10" {...s} />
    <path d="M17.6 8.4 15.3 15.3 8.4 17.6l2.3-6.9z" {...s} />
    <circle cx="13" cy="13" r="0.9" {...s} />
  </svg>
);

export const ChartBars = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 3v19h18" {...s} />
    <path d="M8.5 22v-6.5M13 22v-11M17.5 22v-4.5M22 22v-8.5" {...s} />
  </svg>
);

export const Forecast = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3 21h20" {...s} />
    <path d="M4 17.5 9.5 12l4 3.5L22 6" {...s} />
    <path d="M16.5 6H22v5.5" {...s} />
  </svg>
);

export const Gauge = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3.5 19a9.5 9.5 0 1 1 19 0" {...s} />
    <path d="M13 19l4.6-4.6" {...s} />
    <circle cx="13" cy="19" r="1.1" {...s} />
    <path d="M3.5 19h3M19.5 19h3" {...s} />
  </svg>
);

export const Scales = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 4v18M8 22h10" {...s} />
    <path d="M4 8h18" {...s} />
    <path d="M4 8 1.5 14h5zM22 8l-2.5 6h5" {...s} />
    <circle cx="13" cy="5.5" r="1.4" {...s} />
  </svg>
);

/* ---------------------------------------------------------- datamatics -- */

export const Database = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <ellipse cx="13" cy="6" rx="8.5" ry="3" {...s} />
    <path d="M4.5 6v7c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V6" {...s} />
    <path d="M4.5 13v7c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v-7" {...s} />
  </svg>
);

export const Dashboard = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="3.5" width="8.5" height="7" rx="0.6" {...s} />
    <rect x="14.5" y="3.5" width="8.5" height="4" rx="0.6" {...s} />
    <rect x="3" y="14" width="8.5" height="8.5" rx="0.6" {...s} />
    <rect x="14.5" y="11" width="8.5" height="11.5" rx="0.6" {...s} />
  </svg>
);

export const Report = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M6 2.5h9l5 5v16H6z" {...s} />
    <path d="M15 2.5v5h5" {...s} />
    <path d="M9.5 13h7M9.5 16.5h7M9.5 20h4" {...s} />
  </svg>
);

export const CalendarDay = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5" width="19" height="17.5" rx="0.8" {...s} />
    <path d="M3.5 10h19M8 2.5V7M18 2.5V7" {...s} />
    <rect x="8" y="13.5" width="4" height="4" rx="0.4" {...s} />
  </svg>
);

export const CalendarWeek = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5" width="19" height="17.5" rx="0.8" {...s} />
    <path d="M3.5 10h19M8 2.5V7M18 2.5V7" {...s} />
    <path d="M7.5 14.5h11M7.5 18.5h7" {...s} />
  </svg>
);

export const CalendarMonth = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5" width="19" height="17.5" rx="0.8" {...s} />
    <path d="M3.5 10h19M8 2.5V7M18 2.5V7" {...s} />
    <path d="M8 14h.01M13 14h.01M18 14h.01M8 18.5h.01M13 18.5h.01M18 18.5h.01" {...s} />
  </svg>
);

export const Briefcase = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="2.5" y="8" width="21" height="14" rx="0.8" {...s} />
    <path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h5A1.5 1.5 0 0 1 17 5.5V8" {...s} />
    <path d="M2.5 13.5h21" {...s} />
    <path d="M11 13.5h4" {...s} />
  </svg>
);

/* ----------------------------------------------------------- tectonics -- */

export const Crane = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3 22.5h20" {...s} />
    <path d="M8 22.5V4.5M8 4.5h13" {...s} />
    <path d="M8 9.5 14.5 4.5" {...s} />
    <path d="M18.5 4.5v5.5" {...s} />
    <rect x="16.5" y="10" width="4" height="3.5" rx="0.4" {...s} />
    <path d="M5 22.5 8 17l3 5.5" {...s} />
  </svg>
);

export const Structure = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 22.5h21" {...s} />
    <path d="M6 22.5V8l7-4.5L20 8v14.5" {...s} />
    <path d="M6 13h14M10 22.5V13M16 22.5V13" {...s} />
  </svg>
);

export const Blueprint = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="2.5" y="4.5" width="21" height="17" rx="0.8" {...s} />
    <path d="M2.5 9.5h21M8 4.5v17" {...s} />
    <path d="M12 13.5h7M12 17h4" {...s} />
  </svg>
);

export const Anchor = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="13" cy="5" r="2.4" {...s} />
    <path d="M13 7.4v15M8.5 11h9" {...s} />
    <path d="M3.5 14.5A9.5 9.5 0 0 0 13 22.5a9.5 9.5 0 0 0 9.5-8" {...s} />
    <path d="M3.5 14.5h3M22.5 14.5h-3" {...s} />
  </svg>
);

export const Shield = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 2.5 21.5 6v6.2c0 5.3-3.5 9.2-8.5 10.8C8 21.4 4.5 17.5 4.5 12.2V6z" {...s} />
    <path d="M9.5 12.8 12 15.3l4.8-4.8" {...s} />
  </svg>
);

/* -------------------------------------------------------- digitronics -- */

export const Chip = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="7" y="7" width="12" height="12" rx="1" {...s} />
    <rect x="11" y="11" width="4" height="4" rx="0.4" {...s} />
    <path d="M10 7V3.5M13 7V3.5M16 7V3.5M10 22.5V19M13 22.5V19M16 22.5V19" {...s} />
    <path d="M7 10H3.5M7 13H3.5M7 16H3.5M22.5 10H19M22.5 13H19M22.5 16H19" {...s} />
  </svg>
);

export const Cloud = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M7.8 20a5.3 5.3 0 0 1 .5-10.6 6.8 6.8 0 0 1 12.9 2.1A4.2 4.2 0 0 1 20.5 20z" {...s} />
  </svg>
);

export const Server = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="4" width="20" height="7" rx="0.8" {...s} />
    <rect x="3" y="15" width="20" height="7" rx="0.8" {...s} />
    <path d="M7 7.5h.01M7 18.5h.01" {...s} />
    <path d="M11 7.5h7M11 18.5h7" {...s} />
  </svg>
);

export const Network = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="13" cy="4.5" r="2.4" {...s} />
    <circle cx="5" cy="20" r="2.4" {...s} />
    <circle cx="21" cy="20" r="2.4" {...s} />
    <path d="M11.4 6.6 6.3 17.9M14.6 6.6l5.1 11.3M7.4 20h11.2" {...s} />
  </svg>
);

export const Automation = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M14.5 2.5 6 14.5h6l-1.5 9L19 11.5h-6z" {...s} />
  </svg>
);

export const Robot = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="6.5" y="8.5" width="13" height="10.5" rx="1.4" {...s} />
    <path d="M13 8.5V5" {...s} />
    <circle cx="13" cy="3.8" r="1.3" {...s} />
    <path d="M10.5 12.5h.01M15.5 12.5h.01M10.5 16h5" {...s} />
    <path d="M6.5 12H3.5v4M19.5 12h3v4" {...s} />
  </svg>
);

export const Aircraft = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 2.5c1.1 0 1.9 1.5 1.9 3.4v3.9l7.6 4.3v2.1l-7.6-2.3v4.4l2.5 1.8v1.5L13 20.4l-4.4 1.2v-1.5l2.5-1.8v-4.4L3.5 16.2v-2.1l7.6-4.3V5.9c0-1.9.8-3.4 1.9-3.4z" {...s} />
  </svg>
);

export const GlobeGrid = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="13" cy="13" r="10" {...s} />
    <path d="M3 13h20" {...s} />
    <path d="M13 3c2.9 3.2 4.4 6.4 4.4 10S15.9 19.8 13 23c-2.9-3.2-4.4-6.4-4.4-10S10.1 6.2 13 3z" {...s} />
  </svg>
);

export const Brand = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="13" cy="13" r="9.5" {...s} />
    <path d="M8.5 15.5c3-1 5.5-3.5 6.5-6.5" {...s} />
    <circle cx="16.5" cy="9.5" r="1.6" {...s} />
    <circle cx="9" cy="16" r="1.6" {...s} />
  </svg>
);

export const Layers = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 3 23 8l-10 5L3 8z" {...s} />
    <path d="M3 13l10 5 10-5M3 18l10 5 10-5" {...s} />
  </svg>
);

export const Lock = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="4.5" y="11" width="17" height="11.5" rx="1" {...s} />
    <path d="M8.5 11V7.8a4.5 4.5 0 0 1 9 0V11" {...s} />
    <path d="M13 15.5v3" {...s} />
  </svg>
);

/* ------------------------------------------------------------ maritime -- */

export const Ship = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 17.5 4.6 22.5h16.8l2.1-5z" {...s} />
    <path d="M5.5 17.5v-6h15v6" {...s} />
    <path d="M9 11.5v-4h8v4" {...s} />
    <path d="M13 7.5v-4" {...s} />
  </svg>
);

export const Container = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="2.5" y="7.5" width="21" height="11" rx="0.6" {...s} />
    <path d="M7 7.5v11M11.5 7.5v11M16 7.5v11M20.5 7.5v11" {...s} />
  </svg>
);

export const Route = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="5" cy="19" r="2.2" {...s} />
    <circle cx="21" cy="7" r="2.2" {...s} />
    <path d="M6.6 17.4C9 14 12 9.5 18.8 8" strokeDasharray="2.5 2.5" {...s} />
  </svg>
);

export const People = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="9.5" cy="8.5" r="3.4" {...s} />
    <path d="M3 21.5c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" {...s} />
    <path d="M17 5.6a3.4 3.4 0 0 1 0 6.6M18.5 15.8c2.6.7 4.5 2.9 4.5 5.7" {...s} />
  </svg>
);

export const Waves = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 8.5c2.6-2.6 5.3-2.6 7.9 0s5.3 2.6 7.9 0 5.3-2.6 5.2 0" {...s} />
    <path d="M2.5 14c2.6-2.6 5.3-2.6 7.9 0s5.3 2.6 7.9 0 5.3-2.6 5.2 0" {...s} />
    <path d="M2.5 19.5c2.6-2.6 5.3-2.6 7.9 0s5.3 2.6 7.9 0 5.3-2.6 5.2 0" {...s} />
  </svg>
);

export const Node = ({ size = 26, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 3 23 13 13 23 3 13z" {...s} />
    <circle cx="13" cy="13" r="2.6" {...s} />
  </svg>
);

/* -------------------------------------------------------------- lookup -- */

export type IconComponent = (props: IconProps) => React.JSX.Element;

/**
 * Keyword rules, most specific first. Content lives in siteData; this is the
 * only place that decides which mark a capability carries.
 */
const RULES: [RegExp, IconComponent][] = [
  [/daily/i, CalendarDay],
  [/weekly/i, CalendarWeek],
  [/monthly|periodic/i, CalendarMonth],
  [/management|advisory|consult/i, Briefcase],
  [/dashboard/i, Dashboard],
  [/report|documentation|mis\b/i, Report],
  [/predictive|forecast|modelling|modeling|trend/i, Forecast],
  [/pipeline|data engineering|database|integration|single source/i, Database],
  [/operations intelligence|workflow|kpi|monitoring|efficiency|process/i, Gauge],
  [/pricing|commodity|demand|supply|trade-flow|analysis|analytics|statistic/i, ChartBars],
  [/robot/i, Robot],
  [/avionic|aviation|aircraft/i, Aircraft],
  [/data centre|data center|server|gpu|compute/i, Server],
  [/spatial|geospatial|mapping|global|region/i, GlobeGrid],
  [/artificial intelligence|\bai\b|llm|rag|chatbot|assistant|machine/i, Chip],
  [/cloud|devops|backup/i, Cloud],
  [/automation|edge/i, Automation],
  [/security|secure|permit|regulatory|environmental & social|quality/i, Shield],
  [/brand|design|ui\/ux|communication|web|digital platform/i, Brand],
  [/scalab|maintainab|performance|production readiness|architecture/i, Layers],
  [/software|engineering|technology|transformation|digital/i, Chip],
  [/private ai|encryption|access/i, Lock],
  [/terminal/i, Container],
  [/jett|quay|wharf/i, Anchor],
  [/port|marine|harbour|harbor|berth|dredg/i, Crane],
  [/infrastructure|construction|master plan|asset|facilit|industrial/i, Structure],
  [/feasibility|assessment|study|throughput|capacity|benchmark|tariff/i, Blueprint],
  [/vessel|ship|fleet|charter|voyage|fixture|freight/i, Ship],
  [/cargo|container|bulk|grain|coal|ore|steel|mineral|fertilizer|cement/i, Container],
  [/route|lane|corridor|coordination|logistic/i, Route],
  [/people|team|crew|communit|stakeholder|partner|relationship/i, People],
  [/responsible|dependable|integrity/i, Shield],
  [/ocean|sustainab|environment|climate|future|impact/i, Waves],
  [/market intelligence|research|insight|commercial/i, Compass],
  [/schedule|cost|monitor|balance|governance/i, Scales],
  [/network|ecosystem|connect/i, Network],
  [/build|operate|maintain|optimi[sz]e|commission|strategy|planning/i, Anchor],
];

/** Returns the closest mark for a capability label, with a neutral fallback. */
export function iconFor(label: string): IconComponent {
  for (const [re, Icon] of RULES) {
    if (re.test(label)) return Icon;
  }
  return Node;
}

/** Fixed marks for the four divisions — never keyword-matched. */
export const DIVISION_ICONS: Record<string, IconComponent> = {
  intelligence: Compass,
  datamatics: ChartBars,
  tectonics: Crane,
  digitronics: Chip,
};
